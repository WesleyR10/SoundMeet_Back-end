import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { UserScore, UserScoreId } from "./user-score.aggregate";

export type UserScoreFilter = {
  user_id?: string | null;
  score_type?: string | null;
  reference_id?: string | null;
  created_at_start?: Date | null;
  created_at_end?: Date | null;
};

export class UserScoreSearchParams extends DefaultSearchParams<UserScoreFilter> {
  private constructor(
    props: SearchParamsConstructorProps<UserScoreFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<UserScoreFilter> = {}) {
    return new UserScoreSearchParams(props);
  }

  get filter(): UserScoreFilter | null {
    return this._filter;
  }

  protected set filter(value: UserScoreFilter | null) {
    const _value = value as any;
    const filter = {
      ...(_value?.user_id && { user_id: _value.user_id }),
      ...(_value?.score_type && { score_type: _value.score_type }),
      ...(_value?.reference_id && { reference_id: _value.reference_id }),
      ...(_value?.created_at_start && {
        created_at_start: _value.created_at_start,
      }),
      ...(_value?.created_at_end && { created_at_end: _value.created_at_end }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class UserScoreSearchResult extends DefaultSearchResult<UserScore> {}

export interface IUserScoreRepository
  extends ISearchableRepository<
    UserScore,
    UserScoreId,
    UserScoreFilter,
    UserScoreSearchParams,
    UserScoreSearchResult
  > {
  findByUserAndType(user_id: string, score_type: string): Promise<UserScore[]>;
  getTotalPointsByUser(user_id: string): Promise<number>;
  getPointsByUserAndType(user_id: string, score_type: string): Promise<number>;
}
