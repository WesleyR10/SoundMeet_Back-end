import { AiCifraAnalysisJob } from "../../../domain/ai-cifra-analysis-job.aggregate";

export type AiCifraAnalysisResultOutput = {
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  chords: any[];
  segments: any[];
  artifacts: any | null;
};

export type AiCifraAnalysisJobOutput = {
  id: string;
  ai_cifra_upload_id: string;
  musician_id: string;
  model_id: string;
  status: string;
  progress_percent: number;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  result: AiCifraAnalysisResultOutput | null;
  created_at: Date;
  updated_at: Date;
};

export class AiCifraAnalysisJobOutputMapper {
  static toOutput(entity: AiCifraAnalysisJob): AiCifraAnalysisJobOutput {
    const result = entity.result ? entity.result.toJSON() : null;
    return {
      id: entity.ai_cifra_analysis_job_id.id,
      ai_cifra_upload_id: entity.ai_cifra_upload_id.id,
      musician_id: entity.musician_id.id,
      model_id: entity.model_id,
      status: entity.status,
      progress_percent: entity.progress_percent,
      progress_stage: entity.progress_stage,
      error_code: entity.error_code,
      error_message: entity.error_message,
      started_at: entity.started_at,
      finished_at: entity.finished_at,
      result,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
