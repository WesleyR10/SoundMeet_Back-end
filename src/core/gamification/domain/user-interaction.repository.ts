import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { UserInteraction } from "./user-interaction.aggregate";
import { UserInteractionId } from "./value-objects/gamification-id.vo";

export type UserInteractionFilter = {
  user_id?: string;
  interaction_type?: string;
  target_id?: string;
  points_earned?: number;
  created_at?: Date;
  points_earned_min?: number;
  points_earned_max?: number;
  start_date?: Date;
  end_date?: Date;
};

export class UserInteractionSearchParams extends DefaultSearchParams<UserInteractionFilter> {
  private constructor(
    props: SearchParamsConstructorProps<UserInteractionFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<UserInteractionFilter> = {},
  ): UserInteractionSearchParams {
    return new UserInteractionSearchParams(props);
  }

  get filter(): UserInteractionFilter | null {
    return this._filter;
  }

  protected set filter(value: UserInteractionFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.user_id && { user_id: _value.user_id }),
      ...(_value?.interaction_type && {
        interaction_type: _value.interaction_type,
      }),
      ...(_value?.target_id && { target_id: _value.target_id }),
      ...(_value?.points_earned && { points_earned: _value.points_earned }),
      ...(_value?.created_at && { created_at: _value.created_at }),
      ...(_value?.points_earned_min && {
        points_earned_min: _value.points_earned_min,
      }),
      ...(_value?.points_earned_max && {
        points_earned_max: _value.points_earned_max,
      }),
      ...(_value?.start_date && { start_date: _value.start_date }),
      ...(_value?.end_date && { end_date: _value.end_date }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class UserInteractionSearchResult extends DefaultSearchResult<UserInteraction> {}

export interface IUserInteractionRepository extends ISearchableRepository<
  UserInteraction,
  UserInteractionId,
  UserInteractionFilter,
  UserInteractionSearchParams,
  UserInteractionSearchResult
> {
  findByUserId(user_id: string): Promise<UserInteraction[]>;
  findByInteractionType(interaction_type: string): Promise<UserInteraction[]>;
  findByUserIdAndType(
    user_id: string,
    interaction_type: string,
  ): Promise<UserInteraction[]>;
  findByDateRange(start_date: Date, end_date: Date): Promise<UserInteraction[]>;
  getTotalPointsByUserId(user_id: string): Promise<number>;
  getInteractionCountByType(interaction_type: string): Promise<number>;
}
