import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsIn, IsOptional, IsString, Max, Min } from "class-validator";

import type { ListEstablishmentAnalyticsInput } from "../../../core/establishment/application/use-cases/list-establishment-analytics/list-establishment-analytics.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchEstablishmentAnalyticsDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  @IsOptional()
  per_page?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sort?: string | null;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsIn(["asc", "desc"])
  @IsOptional()
  sort_dir?: SortDirection | null;

  @ApiPropertyOptional({ type: Date })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  date_gte?: Date;

  @ApiPropertyOptional({ type: Date })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  date_lte?: Date;
}

export type SearchEstablishmentAnalyticsInput = Omit<
  ListEstablishmentAnalyticsInput,
  "filter"
> & {
  date_gte?: Date;
  date_lte?: Date;
};
