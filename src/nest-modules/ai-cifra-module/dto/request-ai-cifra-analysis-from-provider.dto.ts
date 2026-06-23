import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class RequestAiCifraAnalysisFromProviderDto {
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
      "Provedor para resolver o áudio (SimpMusic primeiro, fallback Musify)",
    example: "simpmusic",
  })
  @IsString()
  @IsIn(["simpmusic", "musify"])
  provider: "simpmusic" | "musify";

  @ApiProperty({
    description: "YouTube videoId (YouTube/YouTube Music)",
    example: "dQw4w9WgXcQ",
  })
  @IsString()
  @MaxLength(255)
  youtube_video_id: string;
}
