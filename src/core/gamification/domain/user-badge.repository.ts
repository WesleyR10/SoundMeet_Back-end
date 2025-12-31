import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { UserBadge, UserBadgeId } from "./user-badge.aggregate";

export type UserBadgeFilter = {
  user_id?: string | null;
  badge_type?: string | null;
  is_unlocked?: boolean | null;
  progress_min?: number | null;
  progress_max?: number | null;
  badge_category?: string | null;
  badge_rarity?: string | null;
  earned_at_gte?: Date | null;
  earned_at_lte?: Date | null;
};

export class UserBadgeSearchParams extends DefaultSearchParams<UserBadgeFilter> {
  private constructor(
    props: SearchParamsConstructorProps<UserBadgeFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<UserBadgeFilter> = {}) {
    return new UserBadgeSearchParams(props);
  }

  get filter(): UserBadgeFilter | null {
    return this._filter;
  }

  protected set filter(value: UserBadgeFilter | null) {
    const _value = value as any;
    const filter = {
      ...(_value?.user_id && { user_id: _value.user_id }),
      ...(_value?.badge_type && { badge_type: _value.badge_type }),
      ...(_value &&
        typeof _value.is_unlocked === "boolean" && {
          is_unlocked: _value.is_unlocked,
        }),
      ...(_value?.progress_min && { progress_min: _value.progress_min }),
      ...(_value?.progress_max && { progress_max: _value.progress_max }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class UserBadgeSearchResult extends DefaultSearchResult<UserBadge> {}

export interface IUserBadgeRepository extends ISearchableRepository<
  UserBadge,
  UserBadgeId,
  UserBadgeFilter,
  UserBadgeSearchParams,
  UserBadgeSearchResult
> {
  findByUserId(user_id: string): Promise<UserBadge[]>;
  findByUserAndBadgeType(
    user_id: string,
    badge_type: string,
  ): Promise<UserBadge | null>;
  findUnlockedByUser(user_id: string): Promise<UserBadge[]>;
  findInProgressByUser(user_id: string): Promise<UserBadge[]>;
}
