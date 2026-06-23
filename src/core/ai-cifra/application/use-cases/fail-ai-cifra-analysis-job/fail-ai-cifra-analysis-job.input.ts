import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export type FailAiCifraAnalysisJobInput = {
  job_id: string;
  error_code: string;
  error_message: string;
  details?: string | null;
};

export class FailAiCifraAnalysisJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  job_id: string;

  @MaxLength(255)
  @IsString()
  @IsNotEmpty()
  error_code: string;

  @MaxLength(2048)
  @IsString()
  @IsNotEmpty()
  error_message: string;

  @MaxLength(4096)
  @IsString()
  @IsOptional()
  details?: string | null;

  constructor(props: FailAiCifraAnalysisJobInput) {
    Object.assign(this, props);
  }
}
