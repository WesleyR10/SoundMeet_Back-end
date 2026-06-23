import { extname } from "path";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiCifraUpload,
  AiCifraUploadId,
} from "../../../domain/ai-cifra-upload.aggregate";
import { IAiCifraUploadRepository } from "../../../domain/ai-cifra-upload.repository";
import { IAiCifraStorage } from "../../ports/ai-cifra-storage.interface";
import {
  AiCifraUploadOutput,
  AiCifraUploadOutputMapper,
} from "../common/ai-cifra-upload-output";
import { CreateAiCifraUploadInput } from "./create-ai-cifra-upload.input";

export class CreateAiCifraUploadUseCase implements IUseCase<
  CreateAiCifraUploadInput,
  AiCifraUploadOutput
> {
  constructor(
    private readonly uploadRepo: IAiCifraUploadRepository,
    private readonly storage: IAiCifraStorage,
    private readonly maxFileSizeBytes: number,
    private readonly allowedMimeTypes: string[],
  ) {}

  async execute(input: CreateAiCifraUploadInput): Promise<AiCifraUploadOutput> {
    const allowed = new Set(
      this.allowedMimeTypes.map((t) => t.trim()).filter((t) => t.length > 0),
    );

    if (input.file_size > this.maxFileSizeBytes) {
      throw new EntityValidationError([
        {
          file_size: [
            `AI cifra audio file exceeds max size (${this.maxFileSizeBytes} bytes)`,
          ],
        },
      ]);
    }

    if (!allowed.has(input.content_type)) {
      throw new EntityValidationError([
        {
          content_type: [
            `AI cifra audio content type not allowed (${input.content_type})`,
          ],
        },
      ]);
    }

    const uploadId = new AiCifraUploadId();
    const ext = extname(input.original_filename) || "";
    const normalizedExt = ext.length <= 10 ? ext : "";

    const objectKey = `ai-cifra/${input.musician_id}/${uploadId.id}/original${normalizedExt}`;

    const entity = AiCifraUpload.create({
      ai_cifra_upload_id: uploadId,
      musician_id: input.musician_id,
      music_library_id: input.music_library_id ?? null,
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

    return AiCifraUploadOutputMapper.toOutput(
      entity,
      this.storage.getPublicUrl(entity.object_key),
    );
  }
}
