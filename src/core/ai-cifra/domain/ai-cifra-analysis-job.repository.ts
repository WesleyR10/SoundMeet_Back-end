import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
  AiCifraAnalysisJobStatus,
} from "./ai-cifra-analysis-job.aggregate";

export type AiCifraAnalysisJobFilter = {
  musician_id?: string | null;
  ai_cifra_upload_id?: string | null;
  status?: AiCifraAnalysisJobStatus | null;
  model_id?: string | null;
};

export class AiCifraAnalysisJobSearchParams extends DefaultSearchParams<AiCifraAnalysisJobFilter> {
  private constructor(
    props: SearchParamsConstructorProps<AiCifraAnalysisJobFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<AiCifraAnalysisJobFilter> = {},
  ) {
    return new AiCifraAnalysisJobSearchParams(props);
  }

  get filter(): AiCifraAnalysisJobFilter | null {
    return this._filter;
  }

  protected set filter(value: AiCifraAnalysisJobFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value &&
        _value.ai_cifra_upload_id && {
          ai_cifra_upload_id: `${_value.ai_cifra_upload_id}`,
        }),
      ...(_value && _value.status && { status: _value.status }),
      ...(_value && _value.model_id && { model_id: `${_value.model_id}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class AiCifraAnalysisJobSearchResult extends DefaultSearchResult<AiCifraAnalysisJob> {}

export interface IAiCifraAnalysisJobRepository extends ISearchableRepository<
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
  AiCifraAnalysisJobFilter,
  AiCifraAnalysisJobSearchParams,
  AiCifraAnalysisJobSearchResult
> {}
