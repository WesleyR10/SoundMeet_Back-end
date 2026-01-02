import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Points } from "../../../../shared/domain/value-objects/points.vo";
import { UserInteraction } from "../../../../gamification/domain/user-interaction.aggregate";
import {
  IUserInteractionRepository,
  UserInteractionSearchParams,
} from "../../../../gamification/domain/user-interaction.repository";
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
  ) {}

  async execute(input: ScanQRInput): Promise<ScanQROutput> {
    const audienceId = new AudienceId(input.id);
    const audience = await this.audienceRepository.findById(audienceId);

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    // Verificar se o QR code é válido (implementar validação específica)
    await this.validateQRCode(input.qr_code);

    let earnPoints = true;
    if (input.musician_id) {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const todayScans = await this.userInteractionRepo.search(
        UserInteractionSearchParams.create({
          filter: {
            user_id: input.id,
            interaction_type: "scan_qr",
            target_id: input.musician_id,
            start_date: startDate,
            end_date: endDate,
          },
        }),
      );

      if (todayScans.total >= 5) {
        earnPoints = false;
      }
    }

    // Capturar o nível atual e badges antes da ação
    const previousLevel = audience.currentLevel;
    const previousBadges = [...audience.badges];

    // Usar o método do aggregate para escanear QR code do músico
    audience.scanMusicianQRCode(
      input.musician_id || "",
      earnPoints,
    );

    const points = earnPoints
      ? Points.createScanQR({ musician_id: input.musician_id })
      : Points.create(
          0,
          "scan_qr",
          "QR code escaneado",
          {
            musician_id: input.musician_id,
          },
        );
    await this.userInteractionRepo.insert(
      UserInteraction.create({
        user_id: input.id,
        interaction_type: "scan_qr",
        target_id: (input.musician_id ?? null) as any,
        metadata: {
          timestamp: new Date().toISOString(),
          establishment_id: input.establishment_id,
          location: input.location,
        },
        points_earned: points.value,
      }),
    );

    await this.audienceRepository.update(audience);

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
        musician_id: input.musician_id,
        establishment_id: input.establishment_id,
        event_id: input.event_id,
        location: input.location,
        scanned_at: new Date(),
      },
    };
  }

  private async validateQRCode(qrCode: string): Promise<void> {
    // Implementar validação do QR code
    // Por exemplo: verificar formato, verificar se existe no sistema, etc.
    if (!qrCode || qrCode.trim().length === 0) {
      throw new Error("QR code inválido");
    }

    // Adicionar mais validações conforme necessário
    // - Verificar se o QR code existe no sistema
    // - Verificar se não foi usado recentemente pelo mesmo usuário
    // - Verificar se está dentro do período válido
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
