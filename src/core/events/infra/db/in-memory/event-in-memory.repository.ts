import { Uuid } from "../../../../shared/domain";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Event, EventId } from "../../../domain";
import {
  EventFilter,
  EventSearchParams,
  EventSearchResult,
  IEventRepository,
} from "../../../domain";

export class EventInMemoryRepository
  extends InMemorySearchableRepository<Event, EventId, EventFilter>
  implements IEventRepository
{
  sortableFields: string[] = ["date", "start_at", "created_at", "name"];

  private attendees = new Map<string, Set<string>>();
  private performers = new Map<
    string,
    Map<
      string,
      {
        musician_id?: string | null;
        band_id?: string | null;
        fee?: number | null;
        status?: string;
        start_at?: Date | null;
        end_at?: Date | null;
      }
    >
  >();

  async search(props: EventSearchParams): Promise<EventSearchResult> {
    const result = await super.search(props);
    return new EventSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Event[],
    filter: EventFilter | null,
  ): Promise<Event[]> {
    if (!filter) {
      return items;
    }

    return items.filter((event) => {
      let matches = true;

      if (filter.establishment_id) {
        matches =
          matches && event.establishment_id.id === filter.establishment_id;
      }

      if (filter.status) {
        matches = matches && event.status === String(filter.status);
      }

      if (filter.is_public !== null && filter.is_public !== undefined) {
        matches = matches && event.is_public === filter.is_public;
      }

      if (filter.date_gte) {
        matches = matches && event.date >= (filter.date_gte as any);
      }

      if (filter.date_lte) {
        matches = matches && event.date <= (filter.date_lte as any);
      }

      return matches;
    });
  }

  protected applySort(
    items: Event[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir, (sort: string, item: Event) => {
          if (sort === "start_at") {
            return item.start_at;
          }
          return (item as any)[sort];
        })
      : super.applySort(items, "created_at", "desc");
  }

  async addAttendee(
    event_id: EventId,
    audience_id: string,
    now: Date = new Date(),
  ): Promise<void> {
    const event = await this.findById(event_id);
    if (!event) {
      throw new NotFoundError(event_id.id, Event);
    }

    const set = this.attendees.get(event_id.id) ?? new Set<string>();
    const alreadyActive = set.has(audience_id);
    if (alreadyActive) {
      return;
    }

    event.addAttendee(audience_id, now);
    if (event.notification.hasErrors()) {
      throw new EntityValidationError(event.notification.toJSON(), {
        metadata: {
          operation: "event.addAttendee",
          event_id: event_id.id,
          audience_id,
        },
      });
    }

    set.add(audience_id);
    this.attendees.set(event_id.id, set);
    await this.update(event);
  }

  async removeAttendee(
    event_id: EventId,
    audience_id: string,
    now: Date = new Date(),
  ): Promise<void> {
    const event = await this.findById(event_id);
    if (!event) {
      throw new NotFoundError(event_id.id, Event);
    }

    const set = this.attendees.get(event_id.id);
    if (!set || !set.has(audience_id)) {
      throw new NotFoundError(audience_id, Event);
    }

    event.removeAttendee(audience_id, now);
    if (event.notification.hasErrors()) {
      throw new EntityValidationError(event.notification.toJSON(), {
        metadata: {
          operation: "event.removeAttendee",
          event_id: event_id.id,
          audience_id,
        },
      });
    }

    set.delete(audience_id);
    this.attendees.set(event_id.id, set);
    await this.update(event);
  }

  async isAudienceAttendee(
    event_id: EventId,
    audience_id: string,
  ): Promise<boolean> {
    const set = this.attendees.get(event_id.id);
    return Boolean(set?.has(audience_id));
  }

  async addPerformer(
    event_id: EventId,
    performer: {
      musician_id?: string | null;
      band_id?: string | null;
      fee?: number | null;
      status?: string;
      start_at?: Date | null;
      end_at?: Date | null;
    },
  ): Promise<void> {
    const event = await this.findById(event_id);
    if (!event) {
      throw new NotFoundError(event_id.id, Event);
    }

    if (!performer.musician_id && !performer.band_id) {
      throw new InvalidArgumentError("musician_id or band_id is required");
    }

    const id = new Uuid().id;
    const map = this.performers.get(event_id.id) ?? new Map();
    map.set(id, performer);
    this.performers.set(event_id.id, map);
  }

  async removePerformer(
    event_id: EventId,
    event_musician_id: string,
  ): Promise<void> {
    const event = await this.findById(event_id);
    if (!event) {
      throw new NotFoundError(event_id.id, Event);
    }

    if (!event_musician_id) {
      throw new InvalidArgumentError("event_musician_id is required");
    }

    const map = this.performers.get(event_id.id);
    if (!map || !map.has(event_musician_id)) {
      throw new NotFoundError(event_musician_id, Event);
    }
    map.delete(event_musician_id);
    this.performers.set(event_id.id, map);
  }

  async removePerformerByTarget(
    event_id: EventId,
    target: {
      musician_id?: string | null;
      band_id?: string | null;
    },
  ): Promise<void> {
    if (!target.musician_id && !target.band_id) {
      throw new InvalidArgumentError("musician_id or band_id is required");
    }

    const map = this.performers.get(event_id.id);
    if (!map) {
      return;
    }

    for (const [id, performer] of map.entries()) {
      if (target.musician_id && performer.musician_id === target.musician_id) {
        map.delete(id);
        continue;
      }
      if (target.band_id && performer.band_id === target.band_id) {
        map.delete(id);
      }
    }

    this.performers.set(event_id.id, map);
  }

  async isMusicianPerformer(
    event_id: EventId,
    musician_id: string,
  ): Promise<boolean> {
    const map = this.performers.get(event_id.id);
    if (!map) {
      return false;
    }
    for (const performer of map.values()) {
      if (performer.musician_id === musician_id) {
        return true;
      }
    }
    return false;
  }

  getEntity(): new (...args: any[]) => Event {
    return Event;
  }
}
