import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export type UpdateAiCifraAnalysisJobProgressInput = {
  id: string;
  progress_percent: number;
  progress_stage?: string | null;
};

export class UpdateAiCifraAnalysisJobProgressInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsInt()
  @Min(0)
  @Max(100)
  progress_percent: number;

  @MaxLength(64)
  @IsString()
  @IsOptional()
  progress_stage?: string | null;

  constructor(props: UpdateAiCifraAnalysisJobProgressInput) {
    Object.assign(this, props);
  }
}
