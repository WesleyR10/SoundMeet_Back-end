import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class FailAiCifraAnalysisJobDto {
  @ApiProperty({ example: "ANALYSIS_FAILED" })
  @MaxLength(255)
  @IsString()
  @IsNotEmpty()
  error_code: string;

  @ApiProperty({ example: "Falha ao processar áudio" })
  @MaxLength(2048)
  @IsString()
  @IsNotEmpty()
  error_message: string;
}
