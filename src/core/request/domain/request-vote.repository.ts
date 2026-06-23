import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { RequestVote, RequestVoteId } from "./request-vote.aggregate";

export type RequestVoteFilter = {
  request_id?: string | null;
  audience_id?: string | null;
  vote_type?: string | null;
};

export class RequestVoteSearchParams extends DefaultSearchParams<RequestVoteFilter> {
  private constructor(
    props: SearchParamsConstructorProps<RequestVoteFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<RequestVoteFilter> = {}) {
    return new RequestVoteSearchParams(props);
  }

  get filter(): RequestVoteFilter | null {
    return this._filter;
  }

  protected set filter(value: RequestVoteFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.request_id && { request_id: _value.request_id }),
      ...(_value?.audience_id && { audience_id: _value.audience_id }),
      ...(_value?.vote_type && { vote_type: _value.vote_type }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class RequestVoteSearchResult extends DefaultSearchResult<RequestVote> {}

export interface IRequestVoteRepository extends ISearchableRepository<
  RequestVote,
  RequestVoteId,
  RequestVoteFilter,
  RequestVoteSearchParams,
  RequestVoteSearchResult
> {
  findByRequestId(request_id: string): Promise<RequestVote[]>;
  findByRequestAndAudience(
    request_id: string,
    audience_id: string,
  ): Promise<RequestVote | null>;
  countUpVotesByRequestId(request_id: string): Promise<number>;
}
