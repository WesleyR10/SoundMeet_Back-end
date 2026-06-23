import { Uuid } from "../../../../shared/domain";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { EventMusician, EventMusicianId } from "../../../domain";
import {
  EventMusicianFilter,
  EventMusicianSearchParams,
  EventMusicianSearchResult,
  IEventMusicianRepository,
} from "../../../domain";

export class EventMusicianInMemoryRepository
  extends InMemorySearchableRepository<
    EventMusician,
    EventMusicianId,
    EventMusicianFilter
  >
  implements IEventMusicianRepository
{
  sortableFields: string[] = ["created_at", "status", "fee"];

  async search(
    props: EventMusicianSearchParams,
  ): Promise<EventMusicianSearchResult> {
    const result = await super.search(props);
    return new EventMusicianSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByEvent(event_id: Uuid): Promise<EventMusician[]> {
    return this.items.filter((item) => item.event_id.id === event_id.id);
  }

  protected async applyFilter(
    items: EventMusician[],
    filter: EventMusicianFilter | null,
  ): Promise<EventMusician[]> {
    if (!filter) {
      return items;
    }

    return items.filter((eventMusician) => {
      let matches = true;

      if (filter.event_id) {
        matches = matches && eventMusician.event_id.id === filter.event_id;
      }

      if (filter.musician_id) {
        matches =
          matches && eventMusician.musician_id?.id === filter.musician_id;
      }

      if (filter.band_id) {
        matches = matches && eventMusician.band_id?.id === filter.band_id;
      }

      if (filter.status) {
        matches = matches && eventMusician.status === String(filter.status);
      }

      return matches;
    });
  }

  protected applySort(
    items: EventMusician[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(
          items,
          sort,
          sort_dir,
          (sort: string, item: EventMusician) => (item as any)[sort],
        )
      : super.applySort(items, "created_at", "desc");
  }

  getEntity(): new (...args: any[]) => EventMusician {
    return EventMusician;
  }
}
