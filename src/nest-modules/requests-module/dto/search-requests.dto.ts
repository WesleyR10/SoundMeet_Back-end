import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

import { RequestStatusFilter } from "../../../core/request/application/use-cases/list-requests/list-requests.input";

export class SearchRequestsDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  per_page?: number = 15;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsEnum(["asc", "desc"])
  @IsOptional()
  sort_dir?: "asc" | "desc";

  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  event_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  audience_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  musician_id?: string;

  @ApiPropertyOptional({ enum: RequestStatusFilter })
  @IsEnum(RequestStatusFilter)
  @IsOptional()
  status?: RequestStatusFilter;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  song_title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  artist?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  created_after?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  created_before?: string;
}
