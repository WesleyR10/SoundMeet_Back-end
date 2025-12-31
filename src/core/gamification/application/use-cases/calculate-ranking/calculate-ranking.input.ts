import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "../../../domain/value-objects/ranking-type.vo";

export class CalculateRankingInput {
  @IsEnum(RankingTypeEnum)
  type!: RankingTypeEnum;

  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period: RankingPeriodEnum = RankingPeriodEnum.MONTHLY;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number; // 1-12

  @IsInt()
  @Min(1970)
  @Max(3000)
  @IsOptional()
  year?: number;
}
