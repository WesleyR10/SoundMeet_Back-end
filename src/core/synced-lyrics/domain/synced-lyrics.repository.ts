import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { SyncedLyrics, SyncedLyricsId } from "./synced-lyrics.aggregate";

export type SyncedLyricsFilter = {
  musician_id?: string | null;
  query?: string | null;
  has_lrc?: boolean | null;
  provider?: string | null;
  hash?: string | null;
};

export class SyncedLyricsSearchParams extends DefaultSearchParams<SyncedLyricsFilter> {
  private constructor(
    props: SearchParamsConstructorProps<SyncedLyricsFilter> = {},
  ) {
    super(props);
  }

  get filter(): SyncedLyricsFilter | null {
    return this._filter;
  }

  protected set filter(value: SyncedLyricsFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value?.query && { query: `${_value.query}` }),
      ...(typeof _value?.has_lrc === "boolean" && {
        has_lrc: _value.has_lrc,
      }),
      ...(_value?.provider && { provider: `${_value.provider}` }),
      ...(_value?.hash && { hash: `${_value.hash}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }

  static create(props: SearchParamsConstructorProps<SyncedLyricsFilter> = {}) {
    return new SyncedLyricsSearchParams(props);
  }
}

export class SyncedLyricsSearchResult extends DefaultSearchResult<SyncedLyrics> {}

export interface ISyncedLyricsRepository extends ISearchableRepository<
  SyncedLyrics,
  SyncedLyricsId,
  SyncedLyricsFilter,
  SyncedLyricsSearchParams,
  SyncedLyricsSearchResult
> {}
