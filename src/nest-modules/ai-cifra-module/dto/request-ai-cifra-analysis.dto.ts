import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RequestAiCifraAnalysisDto {
  @ApiPropertyOptional({
    description: "ID do modelo de análise (ex: omar_rq_crnn_v1)",
    example: "omar_rq_crnn_v1",
  })
  @IsString()
  @IsOptional()
  model_id?: string;
}
