import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
  AiAudioSeparationJobStatus,
} from "./ai-audio-separation-job.aggregate";

export type AiAudioSeparationJobFilter = {
  musician_id?: string | null;
  ai_audio_upload_id?: string | null;
  status?: AiAudioSeparationJobStatus | null;
  model_id?: string | null;
};

export class AiAudioSeparationJobSearchParams extends DefaultSearchParams<AiAudioSeparationJobFilter> {
  private constructor(
    props: SearchParamsConstructorProps<AiAudioSeparationJobFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<AiAudioSeparationJobFilter> = {},
  ) {
    return new AiAudioSeparationJobSearchParams(props);
  }

  get filter(): AiAudioSeparationJobFilter | null {
    return this._filter;
  }

  protected set filter(value: AiAudioSeparationJobFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value &&
        _value.ai_audio_upload_id && {
          ai_audio_upload_id: `${_value.ai_audio_upload_id}`,
        }),
      ...(_value && _value.status && { status: _value.status }),
      ...(_value && _value.model_id && { model_id: `${_value.model_id}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class AiAudioSeparationJobSearchResult extends DefaultSearchResult<AiAudioSeparationJob> {}

export interface IAiAudioSeparationJobRepository extends ISearchableRepository<
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
  AiAudioSeparationJobFilter,
  AiAudioSeparationJobSearchParams,
  AiAudioSeparationJobSearchResult
> {}
