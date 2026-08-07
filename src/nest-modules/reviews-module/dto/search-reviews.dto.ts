import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchReviewsDto {
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

  @ApiPropertyOptional({ enum: ["rating", "created_at"] })
  @IsString()
  @IsOptional()
  sort?: string | null;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsIn(["asc", "desc"])
  @IsOptional()
  sort_dir?: SortDirection | null;

  // Query string chega como "true"/"false" — sem este Transform o @IsBoolean
  // rejeitaria com 422 (mesma classe do bug do leaderboard, roadmap 7.17).
  @ApiPropertyOptional({ description: "Apenas avaliações com comentário" })
  @Transform(({ value }) =>
    value === undefined ? undefined : value === "true" || value === true,
  )
  @IsBoolean()
  @IsOptional()
  has_comment?: boolean;
}
