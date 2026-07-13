import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { TipStatus } from "../../../core/payment/domain/tip-enums";

export class ListMusicianTipsDto {
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

  @ApiPropertyOptional({ enum: TipStatus })
  @IsEnum(TipStatus)
  @IsOptional()
  status?: TipStatus;
}
