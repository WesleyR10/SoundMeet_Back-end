import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  AiAudioUpload,
  AiAudioUploadId,
  AiAudioUploadStatus,
} from "./ai-audio-upload.aggregate";

export type AiAudioUploadFilter = {
  musician_id?: string | null;
  status?: AiAudioUploadStatus | null;
};

export class AiAudioUploadSearchParams extends DefaultSearchParams<AiAudioUploadFilter> {
  private constructor(
    props: SearchParamsConstructorProps<AiAudioUploadFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<AiAudioUploadFilter> = {}) {
    return new AiAudioUploadSearchParams(props);
  }

  get filter(): AiAudioUploadFilter | null {
    return this._filter;
  }

  protected set filter(value: AiAudioUploadFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.status && { status: _value.status }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class AiAudioUploadSearchResult extends DefaultSearchResult<AiAudioUpload> {}

export interface IAiAudioUploadRepository extends ISearchableRepository<
  AiAudioUpload,
  AiAudioUploadId,
  AiAudioUploadFilter,
  AiAudioUploadSearchParams,
  AiAudioUploadSearchResult
> {}
