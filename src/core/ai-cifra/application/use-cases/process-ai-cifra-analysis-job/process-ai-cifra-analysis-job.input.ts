import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export type ProcessAiCifraAnalysisJobInput = {
  job_id: string;
};

export class ProcessAiCifraAnalysisJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  job_id: string;

  constructor(props: ProcessAiCifraAnalysisJobInput) {
    Object.assign(this, props);
  }
}
