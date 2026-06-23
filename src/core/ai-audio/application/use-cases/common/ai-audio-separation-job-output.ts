import { AiAudioSeparationJob } from "../../../domain/ai-audio-separation-job.aggregate";

export type AiAudioSeparationOutputItem = {
  id: string;
  stem_name: string;
  object_key: string;
  public_url: string | null;
  content_type: string;
  file_size: number | null;
  created_at: Date;
};

export type AiAudioSeparationJobOutput = {
  id: string;
  ai_audio_upload_id: string;
  musician_id: string;
  model_id: string;
  output_prefix: string;
  output_format: "wav" | "flac" | "mp3" | null;
  status: string;
  progress_percent: number;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  outputs: AiAudioSeparationOutputItem[];
  created_at: Date;
  updated_at: Date;
};

export class AiAudioSeparationJobOutputMapper {
  static toOutput(
    entity: AiAudioSeparationJob,
    getPublicUrl: (object_key: string) => string | null,
  ): AiAudioSeparationJobOutput {
    return {
      id: entity.ai_audio_separation_job_id.id,
      ai_audio_upload_id: entity.ai_audio_upload_id.id,
      musician_id: entity.musician_id.id,
      model_id: entity.model_id,
      output_prefix: entity.output_prefix,
      output_format: entity.output_format,
      status: entity.status,
      progress_percent: entity.progress_percent,
      progress_stage: entity.progress_stage,
      error_code: entity.error_code,
      error_message: entity.error_message,
      started_at: entity.started_at,
      finished_at: entity.finished_at,
      outputs: entity.outputs.map((o) => ({
        id: o.ai_audio_separation_output_id.id,
        stem_name: o.stem_name,
        object_key: o.object_key,
        public_url: getPublicUrl(o.object_key),
        content_type: o.content_type,
        file_size: o.file_size,
        created_at: o.created_at,
      })),
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
