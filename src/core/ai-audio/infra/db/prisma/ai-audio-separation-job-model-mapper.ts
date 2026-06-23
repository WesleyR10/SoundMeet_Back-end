import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import {
  AiAudioSeparationOutput,
  AiAudioSeparationOutputId,
} from "../../../domain/ai-audio-separation-output.child-entity";
import { AiAudioSeparationJobModel } from "./ai-audio-model";

export type AiAudioSeparationJobModelProps = AiAudioSeparationJobModel;

export class AiAudioSeparationJobModelMapper {
  static toModel(entity: AiAudioSeparationJob): AiAudioSeparationJobModelProps {
    const model = {
      id: entity.ai_audio_separation_job_id.id,
      aiAudioUploadId: entity.ai_audio_upload_id.id,
      musicianId: entity.musician_id.id,
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

  static toEntity(model: AiAudioSeparationJobModel): AiAudioSeparationJob {
    const output_format =
      model.output_format === "wav" ||
      model.output_format === "flac" ||
      model.output_format === "mp3"
        ? model.output_format
        : null;

    const status =
      model.status === "queued" ||
      model.status === "processing" ||
      model.status === "completed" ||
      model.status === "failed"
        ? model.status
        : "failed";

    return new AiAudioSeparationJob({
      ai_audio_separation_job_id: new AiAudioSeparationJobId(model.id),
      ai_audio_upload_id: model.aiAudioUploadId,
      musician_id: model.musicianId,
      model_id: model.model_id,
      output_prefix: model.output_prefix,
      output_format,
      status,
      progress_percent: model.progress_percent ?? 0,
      progress_stage: model.progress_stage,
      error_code: model.error_code,
      error_message: model.error_message,
      started_at: model.started_at,
      finished_at: model.finished_at,
      outputs: (model.outputs ?? []).map(
        (o) =>
          new AiAudioSeparationOutput({
            ai_audio_separation_output_id: new AiAudioSeparationOutputId(o.id),
            stem_name: o.stem_name,
            object_key: o.object_key,
            content_type: o.content_type,
            file_size: o.file_size,
            created_at: o.created_at,
          }),
      ),
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
