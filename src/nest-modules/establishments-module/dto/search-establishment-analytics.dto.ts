import { Type } from "class-transformer";

import type { ListEstablishmentAnalyticsInput } from "../../../core/establishment/application/use-cases/list-establishment-analytics/list-establishment-analytics.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchEstablishmentAnalyticsDto {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;

  @Type(() => Date)
  date_gte?: Date;

  @Type(() => Date)
  date_lte?: Date;
}

export type SearchEstablishmentAnalyticsInput = Omit<
  ListEstablishmentAnalyticsInput,
  "filter"
> & {
  date_gte?: Date;
  date_lte?: Date;
};
