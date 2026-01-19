import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
} from "./establishment-analytics.entity";

export type EstablishmentAnalyticsFilter = {
  establishment_id?: string | null;
  date_gte?: Date | null;
  date_lte?: Date | null;
};

export class EstablishmentAnalyticsSearchParams extends DefaultSearchParams<EstablishmentAnalyticsFilter> {
  private constructor(
    props: SearchParamsConstructorProps<EstablishmentAnalyticsFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<EstablishmentAnalyticsFilter> = {},
  ) {
    return new EstablishmentAnalyticsSearchParams(props);
  }

  get filter(): EstablishmentAnalyticsFilter | null {
    return this._filter;
  }

  protected set filter(value: EstablishmentAnalyticsFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.establishment_id && {
          establishment_id: `${_value.establishment_id}`,
        }),
      ...(_value && _value.date_gte && { date_gte: _value.date_gte }),
      ...(_value && _value.date_lte && { date_lte: _value.date_lte }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class EstablishmentAnalyticsSearchResult extends DefaultSearchResult<EstablishmentAnalytics> {}

export type EstablishmentAnalyticsDailyMetrics = {
  date: Date;
  events_hosted: number;
  total_attendees: number;
  musicians_hired: number;
  total_spent: number;
  avg_rating: number;
};

export interface IEstablishmentAnalyticsRepository extends ISearchableRepository<
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
  EstablishmentAnalyticsFilter,
  EstablishmentAnalyticsSearchParams,
  EstablishmentAnalyticsSearchResult
> {
  upsertDaily(entity: EstablishmentAnalytics): Promise<EstablishmentAnalytics>;
  findByEstablishmentAndDate(
    establishment_id: string,
    date: Date,
  ): Promise<EstablishmentAnalytics | null>;
  calculateDailyMetrics(
    establishment_id: string,
    date: Date,
  ): Promise<EstablishmentAnalyticsDailyMetrics>;
}
