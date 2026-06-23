import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export type FailAiAudioSeparationJobInput = {
  job_id: string;
  error_code: string;
  error_message: string;
};

export class FailAiAudioSeparationJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  job_id: string;

  @IsString()
  @IsNotEmpty()
  error_code: string;

  @IsString()
  @IsNotEmpty()
  error_message: string;

  @IsString()
  @IsOptional()
  details?: string | null;

  constructor(
    props: FailAiAudioSeparationJobInput & { details?: string | null },
  ) {
    Object.assign(this, props);
  }
}
