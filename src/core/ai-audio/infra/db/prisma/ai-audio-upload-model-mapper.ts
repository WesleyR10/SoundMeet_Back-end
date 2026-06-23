import {
  AiAudioUpload,
  AiAudioUploadId,
} from "../../../domain/ai-audio-upload.aggregate";
import { AiAudioUploadModel } from "./ai-audio-model";

export type AiAudioUploadModelProps = AiAudioUploadModel;

export class AiAudioUploadModelMapper {
  static toModel(entity: AiAudioUpload): AiAudioUploadModelProps {
    const model = {
      id: entity.ai_audio_upload_id.id,
      musicianId: entity.musician_id.id,
      original_filename: entity.original_filename,
      content_type: entity.content_type,
      file_size: entity.file_size,
      object_key: entity.object_key,
      upload_method: entity.upload_method,
      multipart_upload_id: entity.multipart_upload_id,
      duration_seconds: entity.duration_seconds,
      codec: entity.codec,
      sample_rate: entity.sample_rate,
      channels: entity.channels,
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

  static toEntity(model: AiAudioUploadModel): AiAudioUpload {
    const upload_method =
      model.upload_method === "direct" ||
      model.upload_method === "presigned" ||
      model.upload_method === "multipart"
        ? model.upload_method
        : "direct";

    const status =
      model.status === "uploaded" ||
      model.status === "rejected" ||
      model.status === "separation_queued" ||
      model.status === "separating" ||
      model.status === "separated" ||
      model.status === "separation_failed"
        ? model.status
        : "uploaded";

    return new AiAudioUpload({
      ai_audio_upload_id: new AiAudioUploadId(model.id),
      musician_id: model.musicianId,
      original_filename: model.original_filename,
      content_type: model.content_type,
      file_size: model.file_size,
      object_key: model.object_key,
      upload_method,
      multipart_upload_id: model.multipart_upload_id,
      duration_seconds: model.duration_seconds,
      codec: model.codec,
      sample_rate: model.sample_rate,
      channels: model.channels,
      status,
      rejected_reason: model.rejected_reason,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
