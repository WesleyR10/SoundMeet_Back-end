import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Event, EventId, EventStatus } from "./event.aggregate";

export type EventFilter = {
  establishment_id?: string | null;
  status?: EventStatus | string | null;
  date_gte?: Date | null;
  date_lte?: Date | null;
  is_public?: boolean | null;
};

export class EventSearchParams extends DefaultSearchParams<EventFilter> {
  private constructor(props: SearchParamsConstructorProps<EventFilter> = {}) {
    super(props);
  }

  get filter(): EventFilter | null {
    return this._filter;
  }

  protected set filter(value: EventFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const dateFrom = (date: any): Date | null => {
      if (!date) return null;
      if (date instanceof Date) return date;
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const filter = {
      ...(_value &&
        _value.establishment_id && {
          establishment_id: `${_value.establishment_id}`,
        }),
      ...(_value && _value.status && { status: `${_value.status}` }),
      ...(typeof _value?.is_public === "boolean" && {
        is_public: _value.is_public,
      }),
      ...(dateFrom(_value?.date_gte) && {
        date_gte: dateFrom(_value?.date_gte)!,
      }),
      ...(dateFrom(_value?.date_lte) && {
        date_lte: dateFrom(_value?.date_lte)!,
      }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }

  static create(props: SearchParamsConstructorProps<EventFilter> = {}) {
    return new EventSearchParams(props);
  }
}

export class EventSearchResult extends DefaultSearchResult<Event> {}

export interface IEventRepository extends ISearchableRepository<
  Event,
  EventId,
  EventFilter,
  EventSearchParams,
  EventSearchResult
> {
  addAttendee(event_id: EventId, audience_id: string): Promise<void>;
  removeAttendee(event_id: EventId, audience_id: string): Promise<void>;
  isAudienceAttendee(event_id: EventId, audience_id: string): Promise<boolean>;
  addPerformer(
    event_id: EventId,
    performer: {
      musician_id?: string | null;
      band_id?: string | null;
      fee?: number | null;
      status?: string;
      start_at?: Date | null;
      end_at?: Date | null;
    },
  ): Promise<void>;
  removePerformer(event_id: EventId, event_musician_id: string): Promise<void>;
  removePerformerByTarget(
    event_id: EventId,
    target: {
      musician_id?: string | null;
      band_id?: string | null;
    },
  ): Promise<void>;
  isMusicianPerformer(event_id: EventId, musician_id: string): Promise<boolean>;
}
