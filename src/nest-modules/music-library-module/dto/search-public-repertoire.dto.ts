import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { SortDirection } from "../../../core/shared/domain/repository/search-params";

/**
 * Só campos de busca por METADADO. `musician_id` NÃO entra aqui — vem do path,
 * e aceitar pela query permitiria pedir o repertório de outro (ou de todos).
 */
export class SearchPublicRepertoireDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @Min(1)
  @Max(100)
  @IsOptional()
  per_page?: number;

  @ApiPropertyOptional({
    enum: ["title", "artist", "difficulty", "created_at"],
  })
  @IsString()
  @IsOptional()
  sort?: string | null;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsIn(["asc", "desc"])
  @IsOptional()
  sort_dir?: SortDirection | null;

  @ApiPropertyOptional({ description: "Busca por título" })
  @MaxLength(255)
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: "Busca por artista" })
  @MaxLength(255)
  @IsString()
  @IsOptional()
  artist?: string;

  @ApiPropertyOptional({ description: "Filtrar por gênero" })
  @MaxLength(100)
  @IsString()
  @IsOptional()
  genre?: string;
}
