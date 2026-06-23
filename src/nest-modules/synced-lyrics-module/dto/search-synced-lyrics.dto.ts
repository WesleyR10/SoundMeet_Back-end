import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class SearchSyncedLyricsDto {
  @IsUUID()
  musician_id: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  per_page?: number;

  @ApiPropertyOptional({
    enum: ["created_at", "updated_at", "title", "artist", "lrc_version"],
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sort_dir?: "asc" | "desc";

  @ApiPropertyOptional({ description: "Busca em title e artist" })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: ["true", "false"] })
  @IsOptional()
  @IsEnum(["true", "false"])
  has_lrc?: "true" | "false";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hash?: string;

  @ApiPropertyOptional({ enum: ["true", "false"] })
  @IsOptional()
  @IsEnum(["true", "false"])
  include_raw?: "true" | "false";
}
