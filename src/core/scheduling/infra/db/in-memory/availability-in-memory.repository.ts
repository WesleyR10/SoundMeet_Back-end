import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  Availability,
  AvailabilityId,
} from "../../../domain/availability.aggregate";
import {
  AvailabilityFilter,
  AvailabilitySearchParams,
  AvailabilitySearchResult,
  IAvailabilityRepository,
} from "../../../domain/availability.repository";

export class AvailabilityInMemoryRepository
  extends InMemorySearchableRepository<
    Availability,
    AvailabilityId,
    AvailabilityFilter
  >
  implements IAvailabilityRepository
{
  sortableFields: string[] = ["created_at", "updated_at", "is_active"];

  async search(
    props: AvailabilitySearchParams,
  ): Promise<AvailabilitySearchResult> {
    const result = await super.search(props);
    return new AvailabilitySearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByMusicianId(musician_id: string): Promise<Availability | null> {
    return (
      this.items.find((item) => item.musician_id?.id === musician_id) ?? null
    );
  }

  async findByBandId(band_id: string): Promise<Availability | null> {
    return this.items.find((item) => item.band_id?.id === band_id) ?? null;
  }

  protected async applyFilter(
    items: Availability[],
    filter: AvailabilityFilter | null,
  ): Promise<Availability[]> {
    if (!filter) {
      return items;
    }

    return items.filter((availability) => {
      let matches = true;

      if (filter.musician_id) {
        matches =
          matches && availability.musician_id?.id === filter.musician_id;
      }

      if (filter.band_id) {
        matches = matches && availability.band_id?.id === filter.band_id;
      }

      if (filter.is_active !== undefined) {
        matches = matches && availability.is_active === filter.is_active;
      }

      return matches;
    });
  }

  getEntity(): new (...args: any[]) => Availability {
    return Availability;
  }

  protected applySort(
    items: Availability[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir, (sort, item) => {
          if (sort === "created_at") {
            return item.created_at.getTime();
          }
          if (sort === "updated_at") {
            return item.updated_at.getTime();
          }
          if (sort === "is_active") {
            return item.is_active ? 1 : 0;
          }
          return item[sort];
        })
      : super.applySort(items, "created_at", "desc");
  }
}
