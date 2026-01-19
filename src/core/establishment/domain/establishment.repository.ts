import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Establishment, EstablishmentId } from "./establishment.aggregate";

export type EstablishmentFilter = {
  name?: string | null;
  email?: string | null;
  cnpj?: string | null;
  location_city?: string | null;
  amenities?: string[] | null;
  preferred_genres?: string[] | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  is_active?: boolean | null;
  is_verified?: boolean | null;
};

export class EstablishmentSearchParams extends DefaultSearchParams<EstablishmentFilter> {
  private constructor(
    props: SearchParamsConstructorProps<EstablishmentFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<EstablishmentFilter> = {}) {
    return new EstablishmentSearchParams(props);
  }

  get filter(): EstablishmentFilter | null {
    return this._filter;
  }

  protected set filter(value: EstablishmentFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.name && { name: `${_value?.name}` }),
      ...(_value && _value.email && { email: `${_value?.email}` }),
      ...(_value && _value.cnpj && { cnpj: `${_value?.cnpj}` }),
      ...(_value &&
        _value.location_city && { location_city: `${_value?.location_city}` }),
      ...(_value &&
        Array.isArray(_value.amenities) &&
        _value.amenities.length > 0 && { amenities: _value.amenities }),
      ...(_value &&
        Array.isArray(_value.preferred_genres) &&
        _value.preferred_genres.length > 0 && {
          preferred_genres: _value.preferred_genres,
        }),
      ...(_value &&
        _value.capacity_min !== null &&
        _value.capacity_min !== undefined &&
        Number.isFinite(_value.capacity_min) && {
          capacity_min: _value.capacity_min,
        }),
      ...(_value &&
        _value.capacity_max !== null &&
        _value.capacity_max !== undefined &&
        Number.isFinite(_value.capacity_max) && {
          capacity_max: _value.capacity_max,
        }),
      ...(_value &&
        typeof _value.is_active === "boolean" && {
          is_active: _value.is_active,
        }),
      ...(_value &&
        typeof _value.is_verified === "boolean" && {
          is_verified: _value.is_verified,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class EstablishmentSearchResult extends DefaultSearchResult<Establishment> {}

export interface IEstablishmentRepository extends ISearchableRepository<
  Establishment,
  EstablishmentId,
  EstablishmentFilter,
  EstablishmentSearchParams,
  EstablishmentSearchResult
> {
  deleteProfile(establishment_id: EstablishmentId): Promise<void>;
}
