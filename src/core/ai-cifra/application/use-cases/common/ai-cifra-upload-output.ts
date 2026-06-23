import { AiCifraUpload } from "../../../domain/ai-cifra-upload.aggregate";

export type AiCifraUploadOutput = {
  id: string;
  musician_id: string;
  music_library_id: string | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  public_url: string | null;
  status: string;
  rejected_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export class AiCifraUploadOutputMapper {
  static toOutput(
    entity: AiCifraUpload,
    public_url: string | null,
  ): AiCifraUploadOutput {
    return {
      id: entity.ai_cifra_upload_id.id,
      musician_id: entity.musician_id.id,
      music_library_id: entity.music_library_id?.id ?? null,
      original_filename: entity.original_filename,
      content_type: entity.content_type,
      file_size: entity.file_size,
      object_key: entity.object_key,
      public_url,
      status: entity.status,
      rejected_reason: entity.rejected_reason,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
