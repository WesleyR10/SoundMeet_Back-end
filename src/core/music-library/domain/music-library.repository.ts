import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { MusicLibrary, MusicLibraryId } from "./music-library.aggregate";

export type MusicLibraryFilter = {
  musician_id?: string | null;
  title?: string | null;
  artist?: string | null;
  genre?: string | null;
  key?: string | null;
  source?: string | null;
  difficulty?: number | null;
  is_favorite?: boolean | null;
};

export class MusicLibrarySearchParams extends DefaultSearchParams<MusicLibraryFilter> {
  private constructor(
    props: SearchParamsConstructorProps<MusicLibraryFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<MusicLibraryFilter> = {}) {
    return new MusicLibrarySearchParams(props);
  }

  get filter(): MusicLibraryFilter | null {
    return this._filter;
  }

  protected set filter(value: MusicLibraryFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.title && { title: `${_value.title}` }),
      ...(_value && _value.artist && { artist: `${_value.artist}` }),
      ...(_value && _value.genre && { genre: `${_value.genre}` }),
      ...(_value && _value.key && { key: `${_value.key}` }),
      ...(_value && _value.source && { source: `${_value.source}` }),
      ...(_value &&
        _value.difficulty !== null &&
        _value.difficulty !== undefined &&
        Number.isFinite(_value.difficulty) && {
          difficulty: _value.difficulty,
        }),
      ...(_value &&
        typeof _value.is_favorite === "boolean" && {
          is_favorite: _value.is_favorite,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class MusicLibrarySearchResult extends DefaultSearchResult<MusicLibrary> {}

export interface IMusicLibraryRepository extends ISearchableRepository<
  MusicLibrary,
  MusicLibraryId,
  MusicLibraryFilter,
  MusicLibrarySearchParams,
  MusicLibrarySearchResult
> {}
