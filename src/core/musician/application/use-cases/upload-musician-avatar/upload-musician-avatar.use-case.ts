import { randomUUID } from "crypto";

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

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadMusicianAvatarInput = {
  musician_id: string;
  data: NodeJS.ReadableStream | Buffer;
  content_type: string;
  file_size: number;
};

export type UploadMusicianAvatarOutput = MusicianOutput;

export class UploadMusicianAvatarUseCase
  implements IUseCase<UploadMusicianAvatarInput, UploadMusicianAvatarOutput>
{
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly storage: IMusicianStorage,
  ) {}

  async execute(
    input: UploadMusicianAvatarInput,
  ): Promise<UploadMusicianAvatarOutput> {
    const maxSize = Number(
      process.env.MUSICIAN_AVATAR_MAX_SIZE ?? DEFAULT_MAX_FILE_SIZE,
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

    const objectKey = `musicians/${input.musician_id}/avatar/${randomUUID()}.${extension}`;

    await this.storage.putObject({
      object_key: objectKey,
      data: input.data,
      content_type: input.content_type,
    });

    const publicUrl = this.storage.getPublicUrl(objectKey) ?? objectKey;

    musician.changeAvatar(publicUrl);

    if (musician.notification.hasErrors()) {
      throw new EntityValidationError(musician.notification.toJSON());
    }

    await this.musicianRepo.update(musician);

    return MusicianOutputMapper.toOutput(musician);
  }
}
