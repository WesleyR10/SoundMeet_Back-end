import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  AiCifraUpload,
  AiCifraUploadId,
} from "../../../domain/ai-cifra-upload.aggregate";
import { AiCifraUploadModel } from "./ai-cifra-model";

export type AiCifraUploadModelProps = AiCifraUploadModel;

export class AiCifraUploadModelMapper {
  static toModel(entity: AiCifraUpload): AiCifraUploadModelProps {
    const model = {
      id: entity.ai_cifra_upload_id.id,
      musicianId: entity.musician_id.id,
      musicLibraryId: entity.music_library_id?.id ?? null,
      original_filename: entity.original_filename,
      content_type: entity.content_type,
      file_size: entity.file_size,
      object_key: entity.object_key,
      upload_method: entity.upload_method,
      status: entity.status,
      rejected_reason: entity.rejected_reason,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };

    Object.keys(model).forEach((key) => {
      if (model[key as keyof typeof model] === undefined) {
        delete model[key as keyof typeof model];
      }
    });

    return model;
  }

  static toEntity(model: AiCifraUploadModel): AiCifraUpload {
    if (
      model.upload_method !== "direct" &&
      model.upload_method !== "presigned" &&
      model.upload_method !== "multipart"
    ) {
      throw new LoadEntityError([
        {
          upload_method: [
            `Invalid AiCifraUpload upload_method: ${model.upload_method}`,
          ],
        },
      ]);
    }

    if (
      model.status !== "uploaded" &&
      model.status !== "rejected" &&
      model.status !== "analysis_queued" &&
      model.status !== "analyzing" &&
      model.status !== "analyzed" &&
      model.status !== "analysis_failed"
    ) {
      throw new LoadEntityError([
        {
          status: [`Invalid AiCifraUpload status: ${model.status}`],
        },
      ]);
    }

    return new AiCifraUpload({
      ai_cifra_upload_id: new AiCifraUploadId(model.id),
      musician_id: model.musicianId,
      music_library_id: model.musicLibraryId ?? null,
      original_filename: model.original_filename,
      content_type: model.content_type,
      file_size: model.file_size,
      object_key: model.object_key,
      upload_method: model.upload_method,
      status: model.status,
      rejected_reason: model.rejected_reason,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
