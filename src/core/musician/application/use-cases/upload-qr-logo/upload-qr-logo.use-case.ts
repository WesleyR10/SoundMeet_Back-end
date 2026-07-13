import { randomUUID } from "crypto";

import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { IMusicianStorage } from "../../ports/musician-storage.interface";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadQrLogoInput = {
  musician_id: string;
  data: NodeJS.ReadableStream | Buffer;
  content_type: string;
  file_size: number;
};

export type UploadQrLogoOutput = MusicianOutput;

// Espelha UploadMusicianAvatarUseCase (mesma porta IMusicianStorage, mesma
// validação de tamanho/mimetype) — diferença: exige plano PRO (mesmo gate de
// CustomizeQRCodeUseCase) e grava em customizeQRCode() em vez de changeAvatar,
// preservando cores/label já definidos (merge, ver Musician.customizeQRCode).
export class UploadQrLogoUseCase
  implements IUseCase<UploadQrLogoInput, UploadQrLogoOutput>
{
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly storage: IMusicianStorage,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: UploadQrLogoInput): Promise<UploadQrLogoOutput> {
    await this.planCheckService.assertMusicianFeature(
      input.musician_id,
      "custom_qr_code",
    );

    const maxSize = Number(
      process.env.MUSICIAN_QR_LOGO_MAX_SIZE ?? DEFAULT_MAX_FILE_SIZE,
    );

    if (input.file_size > maxSize) {
      const n = new Notification();
      n.addError(
        `File size exceeds the maximum allowed (${maxSize} bytes)`,
        "file",
      );
      throw new EntityValidationError(n.toJSON());
    }

    const extension = ALLOWED_CONTENT_TYPES[input.content_type];
    if (!extension) {
      const n = new Notification();
      n.addError("Only JPEG, PNG or WEBP images are allowed", "file");
      throw new EntityValidationError(n.toJSON());
    }

    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    const objectKey = `qr-logos/${input.musician_id}/${randomUUID()}.${extension}`;

    await this.storage.putObject({
      object_key: objectKey,
      data: input.data,
      content_type: input.content_type,
    });

    const publicUrl = this.storage.getPublicUrl(objectKey) ?? objectKey;

    musician.customizeQRCode({ logo_url: publicUrl });

    if (musician.notification.hasErrors()) {
      throw new EntityValidationError(musician.notification.toJSON());
    }

    await this.musicianRepo.update(musician);

    return MusicianOutputMapper.toOutput(musician);
  }
}
