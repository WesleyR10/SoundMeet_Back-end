import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import {
  IMusicianRepository,
  MusicianFilter,
  MusicianSearchParams,
  MusicianSearchResult,
} from "../../../domain/musician.repository";

export class MusicianInMemoryRepository
  extends InMemorySearchableRepository<Musician, MusicianId, MusicianFilter>
  implements IMusicianRepository
{
  async findByEmail(email: string): Promise<Musician | null> {
    return (
      this.items.find(
        (m) => m.email.value.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  }

  async search(props: MusicianSearchParams): Promise<MusicianSearchResult> {
    const result = await super.search(props);
    return new MusicianSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }
  sortableFields: string[] = ["name", "stage_name", "created_at", "rating"];

  protected async applyFilter(
    items: Musician[],
    filter: MusicianFilter | null,
  ): Promise<Musician[]> {
    if (!filter) {
      return items;
    }

    const filtered = items.filter((musician) => {
      let matches = true;

      if (filter.name) {
        const nameMatch = musician.name
          .toLowerCase()
          .includes(filter.name.toLowerCase());
        matches = matches && nameMatch;
      }

      if (filter.stage_name) {
        matches =
          matches &&
          (musician.stage_name
            ?.toLowerCase()
            .includes(filter.stage_name.toLowerCase()) ??
            false);
      }

      if (filter.email) {
        matches =
          matches &&
          musician.email.value
            .toLowerCase()
            .includes(filter.email.toLowerCase());
      }

      if (filter.genres && filter.genres.length > 0) {
        matches =
          matches &&
          filter.genres.some((genre) =>
            musician.genres.some((musicianGenre) =>
              musicianGenre.toLowerCase().includes(genre.toLowerCase()),
            ),
          );
      }

      if (filter.instruments && filter.instruments.length > 0) {
        matches =
          matches &&
          filter.instruments.some((instrument) =>
            musician.instruments.some((musicianInstrument) =>
              musicianInstrument
                .toLowerCase()
                .includes(instrument.toLowerCase()),
            ),
          );
      }

      const priceRange = musician.profile?.priceRange ?? null;

      if (filter.price_model) {
        matches = matches && priceRange?.model === filter.price_model;
      }

      if (filter.price_currency) {
        matches = matches && priceRange?.currency === filter.price_currency;
      }

      if (
        filter.price_min !== null &&
        filter.price_min !== undefined &&
        Number.isFinite(filter.price_min)
      ) {
        matches = matches && !!priceRange && priceRange.max >= filter.price_min;
      }

      if (
        filter.price_max !== null &&
        filter.price_max !== undefined &&
        Number.isFinite(filter.price_max)
      ) {
        matches = matches && !!priceRange && priceRange.min <= filter.price_max;
      }

      if (filter.is_active !== undefined) {
        matches = matches && musician.is_active === filter.is_active;
      }

      if (filter.is_verified !== undefined) {
        matches = matches && musician.is_verified === filter.is_verified;
      }

      return matches;
    });

    return filtered;
  }

  getEntity(): new (...args: any[]) => Musician {
    return Musician;
  }

  protected applySort(
    items: Musician[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(
          items,
          sort,
          sort_dir,
          (sort: string, item: Musician) => {
            if (sort === "rating") {
              return item.rating.value;
            }
            return item[sort];
          },
        )
      : super.applySort(items, "created_at", "desc");
  }
}
