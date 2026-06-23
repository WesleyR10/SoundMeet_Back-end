export type AiCifraAnalysisEnqueueCommand = {
  job_id: string;
  model_id: string;
  input_object_key: string;
};

export interface IAiCifraAnalysisDispatcher {
  enqueue(command: AiCifraAnalysisEnqueueCommand): Promise<void>;
}
