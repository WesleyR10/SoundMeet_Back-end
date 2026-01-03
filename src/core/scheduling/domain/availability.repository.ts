import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Availability, AvailabilityId } from "./availability.aggregate";

export type AvailabilityFilter = {
  musician_id?: string | null;
  band_id?: string | null;
  is_active?: boolean | null;
};

export class AvailabilitySearchParams extends DefaultSearchParams<AvailabilityFilter> {
  private constructor(
    props: SearchParamsConstructorProps<AvailabilityFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<AvailabilityFilter> = {}) {
    return new AvailabilitySearchParams(props);
  }

  get filter(): AvailabilityFilter | null {
    return this._filter;
  }

  protected set filter(value: AvailabilityFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.band_id && { band_id: `${_value.band_id}` }),
      ...(_value &&
        typeof _value.is_active === "boolean" && {
          is_active: _value.is_active,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class AvailabilitySearchResult extends DefaultSearchResult<Availability> {}

export interface IAvailabilityRepository extends ISearchableRepository<
  Availability,
  AvailabilityId,
  AvailabilityFilter,
  AvailabilitySearchParams,
  AvailabilitySearchResult
> {
  findByMusicianId(musician_id: string): Promise<Availability | null>;
  findByBandId(band_id: string): Promise<Availability | null>;
}
