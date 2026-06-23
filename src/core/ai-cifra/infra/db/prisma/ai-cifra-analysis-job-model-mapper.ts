import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
  AiCifraAnalysisResult,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import { AiCifraAnalysisJobModel } from "./ai-cifra-model";

export type AiCifraAnalysisJobModelProps = AiCifraAnalysisJobModel;

export class AiCifraAnalysisJobModelMapper {
  static toModel(entity: AiCifraAnalysisJob): AiCifraAnalysisJobModelProps {
    const model = {
      id: entity.ai_cifra_analysis_job_id.id,
      aiCifraUploadId: entity.ai_cifra_upload_id.id,
      musicianId: entity.musician_id.id,
      model_id: entity.model_id,
      status: entity.status,
      progress_percent: entity.progress_percent,
      progress_stage: entity.progress_stage,
      error_code: entity.error_code,
      error_message: entity.error_message,
      started_at: entity.started_at,
      finished_at: entity.finished_at,
      bpm: entity.result?.bpm ?? null,
      key: entity.result?.key ?? null,
      time_signature: entity.result?.time_signature ?? null,
      chords: entity.result?.chords ?? null,
      segments: entity.result?.segments ?? null,
      artifacts: entity.result?.artifacts ?? null,
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

  static toEntity(model: AiCifraAnalysisJobModel): AiCifraAnalysisJob {
    if (
      model.status !== "queued" &&
      model.status !== "processing" &&
      model.status !== "completed" &&
      model.status !== "failed"
    ) {
      throw new LoadEntityError([
        {
          status: [`Invalid AiCifraAnalysisJob status: ${model.status}`],
        },
      ]);
    }

    const result =
      model.bpm !== null ||
      model.key !== null ||
      model.time_signature !== null ||
      model.chords !== null ||
      model.segments !== null ||
      model.artifacts !== null
        ? new AiCifraAnalysisResult({
            bpm: model.bpm,
            key: model.key,
            time_signature: model.time_signature,
            chords: Array.isArray(model.chords) ? (model.chords as any) : [],
            segments: Array.isArray(model.segments)
              ? (model.segments as any)
              : [],
            artifacts: model.artifacts,
          })
        : null;

    return new AiCifraAnalysisJob({
      ai_cifra_analysis_job_id: new AiCifraAnalysisJobId(model.id),
      ai_cifra_upload_id: model.aiCifraUploadId,
      musician_id: model.musicianId,
      model_id: model.model_id,
      status: model.status,
      progress_percent: model.progress_percent,
      progress_stage: model.progress_stage,
      error_code: model.error_code,
      error_message: model.error_message,
      started_at: model.started_at,
      finished_at: model.finished_at,
      result,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
