import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { EventAttendee, EventAttendeeId } from "./event-attendee.aggregate";

export type EventAttendeeFilter = {
  event_id?: string | null;
  audience_id?: string | null;
  is_active?: boolean | null;
};

export class EventAttendeeSearchParams extends DefaultSearchParams<EventAttendeeFilter> {
  private constructor(
    props: SearchParamsConstructorProps<EventAttendeeFilter> = {},
  ) {
    super(props);
  }

  get filter(): EventAttendeeFilter | null {
    return this._filter;
  }

  protected set filter(value: EventAttendeeFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.event_id && { event_id: `${_value.event_id}` }),
      ...(_value &&
        _value.audience_id && { audience_id: `${_value.audience_id}` }),
      ...(typeof _value?.is_active === "boolean" && {
        is_active: _value.is_active,
      }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }

  static create(props: SearchParamsConstructorProps<EventAttendeeFilter> = {}) {
    return new EventAttendeeSearchParams(props);
  }
}

export class EventAttendeeSearchResult extends DefaultSearchResult<EventAttendee> {}

export interface IEventAttendeeRepository extends ISearchableRepository<
  EventAttendee,
  EventAttendeeId,
  EventAttendeeFilter,
  EventAttendeeSearchParams,
  EventAttendeeSearchResult
> {
  findByEventAndAudience(
    event_id: Uuid,
    audience_id: Uuid,
  ): Promise<EventAttendee | null>;
  findByEvent(event_id: Uuid): Promise<EventAttendee[]>;
}
