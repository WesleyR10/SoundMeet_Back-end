import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class AiCifraAnalysisSourceCandidateDto {
  @ApiProperty({
    description: "URL direta do áudio (será baixado temporariamente)",
    example: "https://example.com/audio.mp3",
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  audio_url: string;

  @ApiPropertyOptional({
    description: "Content-Type do áudio (se não informado, tenta inferir)",
    example: "audio/mpeg",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  content_type?: string;

  @ApiPropertyOptional({
    description: "Nome original do arquivo (fallback para exibição)",
    example: "my-song.mp3",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  original_filename?: string;

  @ApiPropertyOptional({
    description: "Fonte externa (ex: youtube, spotify, simpMusic)",
    example: "youtube",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;

  @ApiPropertyOptional({
    description: "ID na fonte externa",
    example: "dQw4w9WgXcQ",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source_id?: string;
}

export class RequestAiCifraAnalysisFromSourceDto {
  @ApiPropertyOptional({
    description: "ID do item na MusicLibrary para persistir metadados e cifra",
    example: "9366b7dc-2d71-4799-b91c-c64adb205104",
  })
  @IsOptional()
  @IsUUID("4")
  music_library_id?: string;

  @ApiPropertyOptional({
    description: "ID do modelo de análise (ex: omar_rq_crnn_v1)",
    example: "omar_rq_crnn_v1",
  })
  @IsOptional()
  @IsString()
  model_id?: string;

  @ApiProperty({
    description:
      "Lista ordenada de candidatos; o primeiro que baixar e validar será usado",
    type: [AiCifraAnalysisSourceCandidateDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AiCifraAnalysisSourceCandidateDto)
  candidates: AiCifraAnalysisSourceCandidateDto[];
}
