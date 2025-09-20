import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Musician, MusicianId } from "./musician.aggregate";

export type MusicianFilter = {
  name?: string | null;
  stage_name?: string | null;
  email?: string | null;
  genres?: string[] | null;
  instruments?: string[] | null;
  is_active?: boolean | null;
  is_verified?: boolean | null;
};

export class MusicianSearchParams extends DefaultSearchParams<MusicianFilter> {
  private constructor(
    props: SearchParamsConstructorProps<MusicianFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<MusicianFilter> = {}) {
    return new MusicianSearchParams(props);
  }

  get filter(): MusicianFilter | null {
    return this._filter;
  }

  protected set filter(value: MusicianFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.name && { name: `${_value?.name}` }),
      ...(_value &&
        _value.stage_name && { stage_name: `${_value?.stage_name}` }),
      ...(_value && _value.email && { email: `${_value?.email}` }),
      ...(_value && _value.genres && { genres: _value.genres }),
      ...(_value && _value.instruments && { instruments: _value.instruments }),
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

export class MusicianSearchResult extends DefaultSearchResult<Musician> {}

export interface IMusicianRepository
  extends ISearchableRepository<
    Musician,
    MusicianId,
    MusicianFilter,
    MusicianSearchParams,
    MusicianSearchResult
  > {}
