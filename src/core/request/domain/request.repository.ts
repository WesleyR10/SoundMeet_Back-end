import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Request, RequestId } from "./request.aggregate";

export type RequestFilter = {
  event_id?: string;
  audience_id?: string;
  musician_id?: string;
  status?: string;
  song_title?: string;
  artist?: string;
  created_after?: Date;
  created_before?: Date;
};

export class RequestSearchParams extends DefaultSearchParams<RequestFilter> {
  private constructor(props: SearchParamsConstructorProps<RequestFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<RequestFilter> = {}) {
    return new RequestSearchParams(props);
  }

  get filter(): RequestFilter | null {
    return this._filter;
  }

  protected set filter(value: RequestFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ..._value,
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class RequestSearchResult extends DefaultSearchResult<Request> {}

export interface IRequestRepository extends ISearchableRepository<
  Request,
  RequestId,
  RequestFilter,
  RequestSearchParams,
  RequestSearchResult
> {
  findByAudienceId(audience_id: string): Promise<Request[]>;
  findByMusicianId(musician_id: string): Promise<Request[]>;
  findPendingRequests(musician_id?: string): Promise<Request[]>;
  findPendingRequestsByMusician(musician_id: string): Promise<Request[]>;
  findAcceptedRequestsByMusician(musician_id: string): Promise<Request[]>;
  findRejectedRequestsByMusician(musician_id: string): Promise<Request[]>;
  findRequestsByAudienceAndMusician(
    audience_id: string,
    musician_id: string,
    event_id?: string,
  ): Promise<Request[]>;
  findPendingRequestsByAudienceAndMusician(
    audience_id: string,
    musician_id: string,
    event_id?: string,
  ): Promise<Request[]>;
  countRequestsByAudienceToday(audience_id: string): Promise<number>;
  countRequestsByAudienceInPeriod(
    audience_id: string,
    start_date: Date,
    end_date: Date,
  ): Promise<number>;
  countRequestsByAudienceInPeriodForEvent(
    audience_id: string,
    event_id: string,
    start_date: Date,
    end_date: Date,
  ): Promise<number>;
  countPendingRequestsByMusician(musician_id: string): Promise<number>;
  findRecentRequestsByAudience(
    audience_id: string,
    hours_limit?: number,
  ): Promise<Request[]>;
  findPopularSongs(
    musician_id?: string,
    limit?: number,
  ): Promise<{ song_title: string; artist?: string; count: number }[]>;
  atomicIncrementVotes(request_id: string): Promise<void>;
  findByStatus(status: string): Promise<Request[]>;
  countByStatus(status: string): Promise<number>;
  countByMusicianId(musician_id: Uuid): Promise<number>;
}
