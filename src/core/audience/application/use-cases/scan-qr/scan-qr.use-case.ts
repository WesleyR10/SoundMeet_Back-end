import { UserInteraction } from "../../../../gamification/domain/user-interaction.aggregate";
import {
  IUserInteractionRepository,
  UserInteractionSearchParams,
} from "../../../../gamification/domain/user-interaction.repository";
import {
  Musician,
  MusicianId,
} from "../../../../musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { Points } from "../../../../shared/domain/value-objects/points.vo";
import {
  QR_DEFAULT_BASE_URL,
  QR_MUSICIAN_PATH,
} from "../../../../shared/domain/value-objects/qr-code-link";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { ScanQRInput } from "./scan-qr.input";

export class ScanQRUseCase implements IUseCase<ScanQRInput, ScanQROutput> {
  constructor(
    private audienceRepository: IAudienceRepository,
    private userInteractionRepo: IUserInteractionRepository,
    private musicianRepository: IMusicianRepository,
    private readonly uow: IUnitOfWork,
    /**
     * Base pública do sistema (`APP_URL`). É daqui que sai o host aceito no
     * QR — ver `parseMusicianQRCode`.
     */
    private readonly appBaseUrl: string = QR_DEFAULT_BASE_URL,
  ) {}

  /**
   * Origens aceitas no QR: a configurada (`APP_URL`) e a canônica.
   *
   * As duas, e não só a configurada, porque a GERAÇÃO usa a constante
   * (`QR_DEFAULT_BASE_URL`) enquanto a validação usa a config. Num ambiente em
   * que `APP_URL` é `http://localhost:3000`, aceitar só a configurada faria o
   * scanner recusar exatamente os QRs que o próprio ambiente acabou de gerar.
   *
   * 🔴 Não é afrouxamento: `QR_DEFAULT_BASE_URL` (`soundmeet.com.br`) é
   * domínio NOSSO em qualquer ambiente. O que a lista barra é host de
   * terceiro — o adesivo colado por cima do original.
   *
   * ⚠️ Este comentário afirmava o mesmo de `soundmeet.app` até 07/set/2026, e
   * era FALSO: aquele domínio nunca foi nosso. Enquanto esteve na constante,
   * o scanner aceitava como legítimo um QR apontando para domínio de outra
   * pessoa. Ao mexer aqui, confira de quem é o host antes de confiar nele.
   *
   * `origin` compara protocolo + host + porta de uma vez, então um
   * `http://` para um host que só existe em https já não casa.
   */
  private get allowedOrigins(): string[] {
    const origins = new Set<string>();
    for (const candidate of [this.appBaseUrl, QR_DEFAULT_BASE_URL]) {
      try {
        origins.add(new URL(candidate).origin);
      } catch {
        // Base inválida em config não pode derrubar o scan — apenas não
        // contribui com uma origem.
      }
    }
    return [...origins];
  }

  async execute(input: ScanQRInput): Promise<ScanQROutput> {
    const audienceId = new AudienceId(input.id);
    const audience = await this.audienceRepository.findById(audienceId);

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    const musicianIdFromQr = this.parseMusicianQRCode(input.qr_code);

    if (input.musician_id) {
      const musicianIdFromInput = new MusicianId(input.musician_id);
      if (!musicianIdFromInput.equals(musicianIdFromQr)) {
        throw new InvalidArgumentError(
          "musician_id must match the musician id encoded in the QR code",
        );
      }
    }

    const musician = await this.musicianRepository.findById(musicianIdFromQr);
    if (!musician) {
      throw new NotFoundError(musicianIdFromQr.id, Musician);
    }
    if (!musician.is_active) {
      throw new InvalidArgumentError("Musician is inactive");
    }

    let earnPoints = true;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const todayScans = await this.userInteractionRepo.search(
      UserInteractionSearchParams.create({
        filter: {
          user_id: input.id,
          interaction_type: "scan_qr",
          target_id: musicianIdFromQr.id,
          start_date: startDate,
          end_date: endDate,
        },
      }),
    );

    if (todayScans.total >= 5) {
      earnPoints = false;
    }

    // Capturar o nível atual e badges antes da ação
    const previousLevel = audience.currentLevel;
    const previousBadges = [...audience.badges];

    // Usar o método do aggregate para escanear QR code do músico
    audience.scanMusicianQRCode(musicianIdFromQr.id, earnPoints);

    const points = earnPoints
      ? Points.createScanQR({ musician_id: musicianIdFromQr.id })
      : Points.create(0, "scan_qr", "QR code escaneado", {
          musician_id: musicianIdFromQr.id,
        });
    await this.uow.do(async () => {
      await this.userInteractionRepo.insert(
        UserInteraction.create({
          user_id: input.id,
          interaction_type: "scan_qr",
          target_id: musicianIdFromQr.id,
          metadata: {
            timestamp: new Date().toISOString(),
            establishment_id: input.establishment_id,
            location: input.location,
          },
          points_earned: points.value,
        }),
      );
      await this.audienceRepository.update(audience);
    });

    // Verificar se houve mudança de nível
    const newLevel =
      audience.currentLevel > previousLevel ? audience.currentLevel : undefined;

    // Verificar novos badges conquistados
    const newBadges = audience.badges.filter(
      (badge) => !previousBadges.includes(badge),
    );

    return {
      audience: AudienceOutputMapper.toOutput(audience),
      points_earned: points,
      new_badges: newBadges,
      new_level: newLevel,
      scan_metadata: {
        qr_code: input.qr_code,
        musician_id: musicianIdFromQr.id,
        establishment_id: input.establishment_id,
        event_id: input.event_id,
        location: input.location,
        scanned_at: new Date(),
      },
    };
  }

  /**
   * Extrai o músico do conteúdo lido no QR.
   *
   * ## Dois formatos, de propósito
   *
   * - `https://<app>/musico/<uuid>` — o formato ATUAL. URL https é o que faz o
   *   adesivo de mesa funcionar na câmera nativa de quem ainda não tem o app.
   * - `soundmeet://musician/<uuid>` — legado. Continua aceito porque QR já
   *   impresso não se atualiza: recusá-lo transformaria cada adesivo antigo em
   *   lixo no dia do deploy.
   *
   * ## 🔴 A allowlist de host não é opcional
   *
   * Sem ela, `https://evil.example/musico/<uuid>` casa no padrão de caminho e
   * é aceito como QR legítimo — um adesivo colado por cima do original levaria
   * o fã a um domínio de terceiro que o app trataria como nosso. Mesmo
   * raciocínio de `shared/utils/external-url.ts` (SM-025): comparar o HOST
   * inteiro, nunca `startsWith`/`includes`.
   */
  private parseMusicianQRCode(qrCode: string): MusicianId {
    if (!qrCode || qrCode.trim().length === 0) {
      throw new InvalidArgumentError("QR code inválido");
    }

    const raw = qrCode.trim();
    const rawId = this.extractLegacyId(raw) ?? this.extractLinkId(raw);

    if (!rawId) {
      throw new InvalidArgumentError(
        `QR code must follow ${this.appBaseUrl}/${QR_MUSICIAN_PATH}/<uuid> (or the legacy soundmeet://musician/<uuid>)`,
      );
    }

    try {
      return new MusicianId(rawId);
    } catch (error) {
      throw new InvalidArgumentError(
        "QR code musician id must be a valid UUID",
        {
          cause: error,
        },
      );
    }
  }

  private extractLegacyId(raw: string): string | null {
    const match = raw.match(/^soundmeet:\/\/musician\/([^/?#]+)$/);
    return match ? match[1] : null;
  }

  private extractLinkId(raw: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }

    /*
     * Igualdade de ORIGEM, nunca `startsWith`/`includes`: é o que faz
     * `notsoundmeet.com.br`, `soundmeet.com.br.evil.com` e `evil.example` serem
     * recusados pelos três motivos diferentes que cada um representa.
     */
    if (!this.allowedOrigins.includes(parsed.origin)) {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length !== 2 || segments[0] !== QR_MUSICIAN_PATH) {
      return null;
    }

    return segments[1];
  }
}

export type ScanQROutput = {
  audience: AudienceOutput;
  points_earned: Points;
  new_badges: string[];
  new_level: number | undefined;
  scan_metadata: {
    qr_code: string;
    musician_id?: string;
    establishment_id?: string;
    event_id?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    scanned_at: Date;
  };
};
