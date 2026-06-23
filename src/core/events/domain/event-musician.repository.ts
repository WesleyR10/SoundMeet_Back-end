import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  EventMusician,
  EventMusicianId,
  EventMusicianStatus,
} from "./event-musician.aggregate";

export type EventMusicianFilter = {
  event_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  status?: EventMusicianStatus | string | null;
};

export class EventMusicianSearchParams extends DefaultSearchParams<EventMusicianFilter> {
  private constructor(
    props: SearchParamsConstructorProps<EventMusicianFilter> = {},
  ) {
    super(props);
  }

  get filter(): EventMusicianFilter | null {
    return this._filter;
  }

  protected set filter(value: EventMusicianFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.event_id && { event_id: `${_value.event_id}` }),
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.band_id && { band_id: `${_value.band_id}` }),
      ...(_value && _value.status && { status: `${_value.status}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }

  static create(props: SearchParamsConstructorProps<EventMusicianFilter> = {}) {
    return new EventMusicianSearchParams(props);
  }
}

export class EventMusicianSearchResult extends DefaultSearchResult<EventMusician> {}

export interface IEventMusicianRepository extends ISearchableRepository<
  EventMusician,
  EventMusicianId,
  EventMusicianFilter,
  EventMusicianSearchParams,
  EventMusicianSearchResult
> {
  findByEvent(event_id: Uuid): Promise<EventMusician[]>;
}
