import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  RequestFeedback,
  RequestFeedbackId,
} from "./request-feedback.aggregate";

export type RequestFeedbackFilter = {
  request_id?: string | null;
  rating?: number | null;
  min_rating?: number | null;
  max_rating?: number | null;
  created_after?: Date | null;
  created_before?: Date | null;
};

export class RequestFeedbackSearchParams extends DefaultSearchParams<RequestFeedbackFilter> {
  private constructor(
    props: SearchParamsConstructorProps<RequestFeedbackFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<RequestFeedbackFilter> = {},
  ) {
    return new RequestFeedbackSearchParams(props);
  }

  get filter(): RequestFeedbackFilter | null {
    return this._filter;
  }

  protected set filter(value: RequestFeedbackFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.request_id && { request_id: `${_value.request_id}` }),
      ...(_value &&
        _value.rating !== null &&
        _value.rating !== undefined &&
        Number.isFinite(_value.rating) && { rating: _value.rating }),
      ...(_value &&
        _value.min_rating !== null &&
        _value.min_rating !== undefined &&
        Number.isFinite(_value.min_rating) && {
          min_rating: _value.min_rating,
        }),
      ...(_value &&
        _value.max_rating !== null &&
        _value.max_rating !== undefined &&
        Number.isFinite(_value.max_rating) && {
          max_rating: _value.max_rating,
        }),
      ...(_value &&
        _value.created_after && { created_after: _value.created_after }),
      ...(_value &&
        _value.created_before && { created_before: _value.created_before }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class RequestFeedbackSearchResult extends DefaultSearchResult<RequestFeedback> {}

export interface IRequestFeedbackRepository extends ISearchableRepository<
  RequestFeedback,
  RequestFeedbackId,
  RequestFeedbackFilter,
  RequestFeedbackSearchParams,
  RequestFeedbackSearchResult
> {
  findByRequestId(request_id: string): Promise<RequestFeedback | null>;
}
