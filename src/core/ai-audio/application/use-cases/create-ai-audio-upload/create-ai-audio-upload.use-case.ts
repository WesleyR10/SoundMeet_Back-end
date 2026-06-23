import { extname } from "path";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiAudioUpload,
  AiAudioUploadId,
} from "../../../domain/ai-audio-upload.aggregate";
import { IAiAudioUploadRepository } from "../../../domain/ai-audio-upload.repository";
import { IAiAudioStorage } from "../../ports/ai-audio-storage.interface";
import {
  AiAudioUploadOutput,
  AiAudioUploadOutputMapper,
} from "../common/ai-audio-upload-output";
import { CreateAiAudioUploadInput } from "./create-ai-audio-upload.input";

export class CreateAiAudioUploadUseCase implements IUseCase<
  CreateAiAudioUploadInput,
  AiAudioUploadOutput
> {
  constructor(
    private readonly uploadRepo: IAiAudioUploadRepository,
    private readonly storage: IAiAudioStorage,
    private readonly maxFileSizeBytes: number,
    private readonly allowedMimeTypes: string[],
  ) {}

  async execute(input: CreateAiAudioUploadInput): Promise<AiAudioUploadOutput> {
    const allowed = new Set(
      this.allowedMimeTypes.map((t) => t.trim()).filter((t) => t.length > 0),
    );

    if (input.file_size > this.maxFileSizeBytes) {
      throw new EntityValidationError([
        {
          file_size: [
            `AI audio file exceeds max size (${this.maxFileSizeBytes} bytes)`,
          ],
        },
      ]);
    }

    if (!allowed.has(input.content_type)) {
      throw new EntityValidationError([
        {
          content_type: [
            `AI audio content type not allowed (${input.content_type})`,
          ],
        },
      ]);
    }

    const uploadId = new AiAudioUploadId();
    const ext = extname(input.original_filename) || "";
    const normalizedExt = ext.length <= 10 ? ext : "";

    const objectKey = `ai-audio/${input.musician_id}/${uploadId.id}/original${normalizedExt}`;

    const entity = AiAudioUpload.create({
      ai_audio_upload_id: uploadId,
      musician_id: input.musician_id,
      original_filename: input.original_filename,
      content_type: input.content_type,
      file_size: input.file_size,
      object_key: objectKey,
      upload_method: "direct",
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.storage.putObject({
      object_key: entity.object_key,
      data: input.data,
      content_type: entity.content_type,
    });

    await this.uploadRepo.insert(entity);

    return AiAudioUploadOutputMapper.toOutput(
      entity,
      this.storage.getPublicUrl(entity.object_key),
    );
  }
}
