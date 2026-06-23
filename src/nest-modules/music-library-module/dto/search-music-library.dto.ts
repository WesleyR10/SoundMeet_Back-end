import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class SearchMusicLibraryDto {
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
    enum: ["title", "artist", "difficulty", "created_at", "updated_at"],
  })
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsIn(["asc", "desc"])
  @IsOptional()
  sort_dir?: "asc" | "desc";

  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  musician_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  artist?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  genre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  key?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : undefined,
  )
  @IsOptional()
  is_favorite?: boolean;
}
