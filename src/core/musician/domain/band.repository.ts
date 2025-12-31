import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Band, BandId } from "./band.aggregate";

export type BandFilter = {
  name?: string | null;
  genres?: string[] | null;
  is_active?: boolean | null;
};

export class BandSearchParams extends DefaultSearchParams<BandFilter> {
  private constructor(props: SearchParamsConstructorProps<BandFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<BandFilter> = {}) {
    return new BandSearchParams(props);
  }

  get filter(): BandFilter | null {
    return this._filter;
  }

  protected set filter(value: BandFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.name && { name: `${_value?.name}` }),
      ...(_value && _value.genres && { genres: _value.genres }),
      ...(_value &&
        typeof _value.is_active === "boolean" && {
          is_active: _value.is_active,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class BandSearchResult extends DefaultSearchResult<Band> {}

export interface IBandRepository extends ISearchableRepository<
  Band,
  BandId,
  BandFilter,
  BandSearchParams,
  BandSearchResult
> {}
