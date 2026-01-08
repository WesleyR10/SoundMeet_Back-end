import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Currency } from "../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../shared/domain/value-objects/price-range.vo";
import { Band, BandId } from "./band.aggregate";

export type BandFilter = {
  name?: string | null;
  genres?: string[] | null;
  price_model?: PriceModel | null;
  price_min?: number | null;
  price_max?: number | null;
  price_currency?: Currency | null;
  is_active?: boolean | null;
};

const isPriceModel = (value: unknown): value is PriceModel => {
  return value === "per_event" || value === "per_hour";
};

const isCurrency = (value: unknown): value is Currency => {
  return (Object.values(Currency) as string[]).includes(value as string);
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
        isPriceModel((_value as any).price_model) && {
          price_model: (_value as any).price_model,
        }),
      ...(_value &&
        _value.price_min !== null &&
        _value.price_min !== undefined &&
        Number.isFinite(_value.price_min) && { price_min: _value.price_min }),
      ...(_value &&
        _value.price_max !== null &&
        _value.price_max !== undefined &&
        Number.isFinite(_value.price_max) && { price_max: _value.price_max }),
      ...(_value &&
        isCurrency((_value as any).price_currency) && {
          price_currency: (_value as any).price_currency,
        }),
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
