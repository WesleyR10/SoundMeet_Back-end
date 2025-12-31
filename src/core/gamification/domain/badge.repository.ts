import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Badge, BadgeCategory, BadgeId, BadgeRarity } from "./badge.aggregate";

export type BadgeFilter = {
  name?: string | null;
  category?: BadgeCategory | null;
  rarity?: BadgeRarity | null;
  is_active?: boolean | null;
};

export class BadgeSearchParams extends DefaultSearchParams<BadgeFilter> {
  private constructor(props: SearchParamsConstructorProps<BadgeFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<BadgeFilter> = {}) {
    return new BadgeSearchParams(props);
  }

  get filter(): BadgeFilter | null {
    return this._filter;
  }

  protected set filter(value: BadgeFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.name && { name: `${_value?.name}` }),
      ...(_value && _value.category && { category: _value.category }),
      ...(_value && _value.rarity && { rarity: _value.rarity }),
      ...(_value &&
        typeof _value.is_active === "boolean" && {
          is_active: _value.is_active,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class BadgeSearchResult extends DefaultSearchResult<Badge> {}

export interface IBadgeRepository extends ISearchableRepository<
  Badge,
  BadgeId,
  BadgeFilter,
  BadgeSearchParams,
  BadgeSearchResult
> {}
