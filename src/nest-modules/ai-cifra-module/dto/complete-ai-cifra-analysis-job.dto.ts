import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class CompleteAiCifraAnalysisJobDto {
  @ApiPropertyOptional({ example: 120, description: "BPM estimado" })
  @IsNumber()
  @IsOptional()
  bpm?: number | null;

  @ApiPropertyOptional({ example: "C#m", description: "Tom estimado" })
  @MaxLength(64)
  @IsString()
  @IsOptional()
  key?: string | null;

  @ApiPropertyOptional({ example: "4/4", description: "Fórmula de compasso" })
  @MaxLength(32)
  @IsString()
  @IsOptional()
  time_signature?: string | null;

  @ApiPropertyOptional({
    description: "Lista de acordes com timestamps",
    example: [
      { start_seconds: 0, end_seconds: 2, chord: "C", confidence: 0.9 },
    ],
  })
  @IsOptional()
  chords?: any[];

  @ApiPropertyOptional({
    description: "Segmentação estrutural",
    example: [{ start_seconds: 0, end_seconds: 10, label: "intro" }],
  })
  @IsOptional()
  segments?: any[];

  @ApiPropertyOptional({
    description: "Artefatos adicionais (ex: caminhos de JSON/JAMS no storage)",
    example: { internal_json_object_key: "ai-cifra/.../analysis.json" },
  })
  @IsOptional()
  artifacts?: any | null;
}
