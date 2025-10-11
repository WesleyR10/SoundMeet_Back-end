import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Ranking, RankingId } from "./ranking.aggregate";

export type RankingFilter = {
  user_id?: string | null;
  ranking_type?: string | null;
  period?: string | null;
  position_max?: number | null;
  is_current_period?: boolean | null;
};

export class RankingSearchParams extends DefaultSearchParams<RankingFilter> {
  private constructor(props: SearchParamsConstructorProps<RankingFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<RankingFilter> = {}) {
    return new RankingSearchParams(props);
  }

  get filter(): RankingFilter | null {
    return this._filter;
  }

  protected set filter(value: RankingFilter | null) {
    const _value = value as any;
    const filter = {
      ...(_value?.user_id && { user_id: _value.user_id }),
      ...(_value?.ranking_type && { ranking_type: _value.ranking_type }),
      ...(_value?.period && { period: _value.period }),
      ...(_value?.position_max && { position_max: _value.position_max }),
      ...(_value &&
        typeof _value.is_current_period === "boolean" && {
          is_current_period: _value.is_current_period,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class RankingSearchResult extends DefaultSearchResult<Ranking> {}

export interface IRankingRepository
  extends ISearchableRepository<
    Ranking,
    RankingId,
    RankingFilter,
    RankingSearchParams,
    RankingSearchResult
  > {
  findByUserAndEstablishment(
    user_id: string,
    establishment_id: string,
    period_type: string,
  ): Promise<Ranking | null>;
  findByUserAndTypeAndPeriod(
    user_id: string,
    ranking_type: string,
    period: string,
    period_start: Date,
    period_end: Date,
  ): Promise<Ranking | null>;
  findTopRankings(
    establishment_id: string,
    period_type: string,
    limit?: number,
  ): Promise<Ranking[]>;
  findCurrentRankings(ranking_type: string, period: string): Promise<Ranking[]>;
}
