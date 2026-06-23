import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class PreloadMusifyCatalogDto {
  @ApiProperty({
    enum: ["trending", "playlist", "search_playlists"],
    description: "Origem do catálogo no Musify/Piped",
    example: "trending",
  })
  @IsString()
  @IsIn(["trending", "playlist", "search_playlists"])
  source: "trending" | "playlist" | "search_playlists";

  @ApiPropertyOptional({
    description: "Região do trending (ex: BR)",
    example: "BR",
    default: "BR",
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  region?: string;

  @ApiPropertyOptional({
    description: "ID da playlist do YouTube",
    example: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  playlist_id?: string;

  @ApiPropertyOptional({
    description:
      "Query para buscar playlists no Musify/Piped (usado em source=search_playlists)",
    example: "Top Músicas Brasileiras",
    default: "Top Músicas Brasileiras",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string;

  @ApiPropertyOptional({
    description:
      "Quantidade máxima de playlists a varrer (usado em source=search_playlists)",
    example: 3,
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  playlists_limit?: number;

  @ApiPropertyOptional({
    description:
      "Provedor preferido para resolver áudio (usado em source=search_playlists)",
    example: "simpmusic",
    default: "simpmusic",
  })
  @IsOptional()
  @IsString()
  @IsIn(["simpmusic", "musify"])
  provider?: "simpmusic" | "musify";

  @ApiPropertyOptional({
    description: "Quantidade máxima de músicas a processar",
    example: 25,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "ID do modelo de análise (ex: omar_rq_crnn_v1)",
    example: "omar_rq_crnn_v1",
  })
  @IsOptional()
  @IsString()
  model_id?: string;
}
