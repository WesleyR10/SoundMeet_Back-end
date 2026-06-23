import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobId,
  SyncedLyricsBulkJobStatus,
} from "./synced-lyrics-bulk-job.aggregate";

export type SyncedLyricsBulkJobFilter = {
  musician_id?: string | null;
  status?: SyncedLyricsBulkJobStatus | null;
};

export class SyncedLyricsBulkJobSearchParams extends DefaultSearchParams<SyncedLyricsBulkJobFilter> {
  private constructor(
    props: SearchParamsConstructorProps<SyncedLyricsBulkJobFilter> = {},
  ) {
    super(props);
  }

  get filter(): SyncedLyricsBulkJobFilter | null {
    return this._filter;
  }

  protected set filter(value: SyncedLyricsBulkJobFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value?.status && { status: _value.status }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }

  static create(
    props: SearchParamsConstructorProps<SyncedLyricsBulkJobFilter> = {},
  ) {
    return new SyncedLyricsBulkJobSearchParams(props);
  }
}

export class SyncedLyricsBulkJobSearchResult extends DefaultSearchResult<SyncedLyricsBulkJob> {}

export interface ISyncedLyricsBulkJobRepository extends ISearchableRepository<
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobId,
  SyncedLyricsBulkJobFilter,
  SyncedLyricsBulkJobSearchParams,
  SyncedLyricsBulkJobSearchResult
> {}
