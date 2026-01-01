import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Band, BandId } from "../../../domain/band.aggregate";
import {
  BandFilter,
  BandSearchParams,
  BandSearchResult,
  IBandRepository,
} from "../../../domain/band.repository";

export class BandInMemoryRepository
  extends InMemorySearchableRepository<Band, BandId, BandFilter>
  implements IBandRepository
{
  sortableFields: string[] = ["name", "created_at"];

  async search(props: BandSearchParams): Promise<BandSearchResult> {
    const result = await super.search(props);
    return new BandSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Band[],
    filter: BandFilter | null,
  ): Promise<Band[]> {
    if (!filter) {
      return items;
    }

    const filtered = items.filter((band) => {
      let matches = true;

      if (filter.name) {
        matches =
          matches &&
          band.name.toLowerCase().includes(filter.name.toLowerCase());
      }

      if (filter.genres?.length) {
        matches =
          matches &&
          filter.genres.every((g) => band.genres.some((bg) => bg === g));
      }

      if (filter.is_active !== undefined) {
        matches = matches && band.is_active === filter.is_active;
      }

      return matches;
    });

    return filtered;
  }

  getEntity(): new (...args: any[]) => Band {
    return Band;
  }

  protected applySort(
    items: Band[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
