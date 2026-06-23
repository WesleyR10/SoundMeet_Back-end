import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class MatchSyncedLyricsOnLrclibDto {
  @IsString()
  @IsNotEmpty()
  artist: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: "Duração em ms" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationMs?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxResults?: number;
}
