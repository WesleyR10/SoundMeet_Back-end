import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export type CompleteAiCifraAnalysisJobInput = {
  job_id: string;
  bpm?: number | null;
  key?: string | null;
  time_signature?: string | null;
  chords?: any[];
  segments?: any[];
  artifacts?: any | null;
};

export class CompleteAiCifraAnalysisJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  job_id: string;

  @IsNumber()
  @IsOptional()
  bpm?: number | null;

  @MaxLength(64)
  @IsString()
  @IsOptional()
  key?: string | null;

  @MaxLength(32)
  @IsString()
  @IsOptional()
  time_signature?: string | null;

  @IsOptional()
  chords?: any[];

  @IsOptional()
  segments?: any[];

  @IsOptional()
  artifacts?: any | null;

  constructor(props: CompleteAiCifraAnalysisJobInput) {
    Object.assign(this, props);
  }
}
