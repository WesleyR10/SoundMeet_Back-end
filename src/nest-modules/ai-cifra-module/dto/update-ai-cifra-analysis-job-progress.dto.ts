import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateAiCifraAnalysisJobProgressDto {
  @ApiProperty({ example: 20, description: "Progresso do job (0-100)" })
  @IsInt()
  @Min(0)
  @Max(100)
  progress_percent: number;

  @ApiPropertyOptional({
    example: "chords",
    description:
      "Stage do processamento (ex: starting, chords, segments, completed)",
  })
  @MaxLength(64)
  @IsString()
  @IsOptional()
  progress_stage?: string | null;
}
