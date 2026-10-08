import { Uuid } from "../../../../shared/domain";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { EventAttendee, EventAttendeeId } from "../../../domain";
import {
  EventAttendeeFilter,
  EventAttendeeSearchParams,
  EventAttendeeSearchResult,
  IEventAttendeeRepository,
} from "../../../domain";

export class EventAttendeeInMemoryRepository
  extends InMemorySearchableRepository<
    EventAttendee,
    EventAttendeeId,
    EventAttendeeFilter
  >
  implements IEventAttendeeRepository
{
  sortableFields: string[] = ["joined_at", "left_at"];

  async search(
    props: EventAttendeeSearchParams,
  ): Promise<EventAttendeeSearchResult> {
    const result = await super.search(props);
    return new EventAttendeeSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByEventAndAudience(
    event_id: Uuid,
    audience_id: Uuid,
  ): Promise<EventAttendee | null> {
    const item = this.items.find(
      (attendee) =>
        attendee.event_id.id === event_id.id &&
        attendee.audience_id.id === audience_id.id,
    );
    return item ?? null;
  }

  async findByEvent(event_id: Uuid): Promise<EventAttendee[]> {
    return this.items.filter((item) => item.event_id.id === event_id.id);
  }

  async countDistinctAudienceByEvents(event_ids: string[]): Promise<number> {
    if (event_ids.length === 0) return 0;

    const wanted = new Set(event_ids);
    const audiences = new Set(
      this.items
        .filter((item) => wanted.has(item.event_id.id))
        .map((item) => item.audience_id.id),
    );

    return audiences.size;
  }

  async countByEvents(event_ids: string[]): Promise<Map<string, number>> {
    const wanted = new Set(event_ids);
    const counts = new Map<string, number>();
    for (const item of this.items) {
      const id = item.event_id.id;
      if (wanted.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

  protected async applyFilter(
    items: EventAttendee[],
    filter: EventAttendeeFilter | null,
  ): Promise<EventAttendee[]> {
    if (!filter) {
      return items;
    }

    return items.filter((attendee) => {
      let matches = true;

      if (filter.event_id) {
        matches = matches && attendee.event_id.id === filter.event_id;
      }

      if (filter.audience_id) {
        matches = matches && attendee.audience_id.id === filter.audience_id;
      }

      if (filter.is_active !== null && filter.is_active !== undefined) {
        matches = matches && attendee.is_active === filter.is_active;
      }

      return matches;
    });
  }

  protected applySort(
    items: EventAttendee[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(
          items,
          sort,
          sort_dir,
          (sort: string, item: EventAttendee) => (item as any)[sort],
        )
      : super.applySort(items, "joined_at", "desc");
  }

  getEntity(): new (...args: any[]) => EventAttendee {
    return EventAttendee;
  }
}
