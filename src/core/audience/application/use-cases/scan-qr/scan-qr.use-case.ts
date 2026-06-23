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
  ) {}

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

  private parseMusicianQRCode(qrCode: string): MusicianId {
    if (!qrCode || qrCode.trim().length === 0) {
      throw new InvalidArgumentError("QR code inválido");
    }

    const match = qrCode.trim().match(/^soundmeet:\/\/musician\/([^/]+)$/);
    if (!match) {
      throw new InvalidArgumentError(
        "QR code must follow soundmeet://musician/<uuid>",
      );
    }

    try {
      return new MusicianId(match[1]);
    } catch (error) {
      throw new InvalidArgumentError(
        "QR code musician id must be a valid UUID",
        {
          cause: error,
        },
      );
    }
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
