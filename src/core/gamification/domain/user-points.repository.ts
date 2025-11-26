import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { UserPoints, UserPointsId } from "./user-points.aggregate";

export type UserPointsFilter = {
  audienceId?: string | null;
  points_gte?: number | null;
  points_lte?: number | null;
  source?: string | null;
};

export class UserPointsSearchParams extends DefaultSearchParams<UserPointsFilter> {
  private constructor(
    props: SearchParamsConstructorProps<UserPointsFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<UserPointsFilter> = {}) {
    return new UserPointsSearchParams(props);
  }

  get filter(): UserPointsFilter | null {
    return this._filter;
  }

  protected set filter(value: UserPointsFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.audienceId && { audienceId: `${_value?.audienceId}` }),
      ...(_value &&
        typeof _value.points_gte === "number" && {
          points_gte: _value.points_gte,
        }),
      ...(_value &&
        typeof _value.points_lte === "number" && {
          points_lte: _value.points_lte,
        }),
      ...(_value &&
        _value.source && {
          source: _value.source,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class UserPointsSearchResult extends DefaultSearchResult<UserPoints> {}

export interface IUserPointsRepository
  extends ISearchableRepository<
    UserPoints,
    UserPointsId,
    UserPointsFilter,
    UserPointsSearchParams,
    UserPointsSearchResult
  > {
  findByUserId(user_id: string): Promise<UserPoints | null>;
  findTopUsers(limit?: number): Promise<UserPoints[]>;
  findByLevel(level: number): Promise<UserPoints[]>;
}
