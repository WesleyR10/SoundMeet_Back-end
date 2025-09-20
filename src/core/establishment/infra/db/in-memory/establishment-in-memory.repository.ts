import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import {
  EstablishmentFilter,
  EstablishmentSearchParams,
  EstablishmentSearchResult,
  IEstablishmentRepository,
} from "../../../domain/establishment.repository";

export class EstablishmentInMemoryRepository
  extends InMemorySearchableRepository<
    Establishment,
    EstablishmentId,
    EstablishmentFilter
  >
  implements IEstablishmentRepository
{
  async search(
    props: EstablishmentSearchParams,
  ): Promise<EstablishmentSearchResult> {
    const result = await super.search(props);
    return new EstablishmentSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }
  sortableFields: string[] = ["name", "created_at", "rating", "email"];

  protected async applyFilter(
    items: Establishment[],
    filter: EstablishmentFilter | null,
  ): Promise<Establishment[]> {
    if (!filter) {
      return items;
    }

    const filtered = items.filter((establishment) => {
      let matches = true;

      if (filter.name) {
        const nameMatch = establishment.name
          .toLowerCase()
          .includes(filter.name.toLowerCase());
        matches = matches && nameMatch;
      }

      if (filter.email) {
        matches =
          matches &&
          establishment.email.value
            .toLowerCase()
            .includes(filter.email.toLowerCase());
      }

      if (filter.cnpj) {
        matches =
          matches && (establishment.cnpj?.value.includes(filter.cnpj) ?? false);
      }

      if (filter.is_active !== undefined) {
        matches = matches && establishment.is_active === filter.is_active;
      }

      if (filter.is_verified !== undefined) {
        matches = matches && establishment.is_verified === filter.is_verified;
      }

      return matches;
    });

    return filtered;
  }

  getEntity(): new (...args: any[]) => Establishment {
    return Establishment;
  }

  protected applySort(
    items: Establishment[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(
          items,
          sort,
          sort_dir,
          (sort: string, item: Establishment) => {
            if (sort === "rating") {
              return item.rating.value;
            }
            return item[sort];
          },
        )
      : super.applySort(items, "created_at", "desc");
  }
}
