import {
  AiCifraChordSegment,
  AiCifraStructureSegment,
} from "../../domain/ai-cifra-analysis-job.aggregate";

export type AiCifraAnalysisClientRequest = {
  job_id: string;
  model_id: string;
  input_object_key: string;
  artist?: string | null;
  title?: string | null;
  genre?: string | null;
};

export type AiCifraAnalysisClientResponse = {
  bpm?: number | null;
  key?: string | null;
  time_signature?: string | null;
  chords?: AiCifraChordSegment[];
  segments?: AiCifraStructureSegment[];
  artifacts?: Record<string, any> | null;
};

export interface IAiCifraAnalysisClient {
  analyze(
    input: AiCifraAnalysisClientRequest,
  ): Promise<AiCifraAnalysisClientResponse>;
}
