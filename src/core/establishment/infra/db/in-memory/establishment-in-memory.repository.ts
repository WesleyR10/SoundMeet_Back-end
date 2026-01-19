import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
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
import { EstablishmentProfile } from "../../../domain/establishment-profile.aggregate";

export class EstablishmentInMemoryRepository
  extends InMemorySearchableRepository<
    Establishment,
    EstablishmentId,
    EstablishmentFilter
  >
  implements IEstablishmentRepository
{
  async deleteProfile(establishment_id: EstablishmentId): Promise<void> {
    const entity = await this.findById(establishment_id);
    if (!entity) {
      throw new NotFoundError(establishment_id.id, this.getEntity());
    }

    if (!entity.profile) {
      throw new NotFoundError(establishment_id.id, EstablishmentProfile);
    }

    entity.removeProfile();
    await this.update(entity);
  }

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
      const profile = establishment.profile;

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

      if (filter.location_city) {
        matches =
          matches &&
          !!profile &&
          profile.location.city
            .toLowerCase()
            .includes(filter.location_city.toLowerCase());
      }

      if (filter.amenities && filter.amenities.length > 0) {
        matches =
          matches &&
          !!profile &&
          profile.amenities.some((amenity) =>
            filter.amenities!.some(
              (f) => f.toLowerCase() === amenity.toLowerCase(),
            ),
          );
      }

      if (filter.preferred_genres && filter.preferred_genres.length > 0) {
        matches =
          matches &&
          !!profile &&
          profile.preferredGenres.some((genre) =>
            filter.preferred_genres!.some(
              (f) => f.toLowerCase() === genre.toLowerCase(),
            ),
          );
      }

      if (
        filter.capacity_min !== null &&
        filter.capacity_min !== undefined &&
        Number.isFinite(filter.capacity_min)
      ) {
        matches =
          matches &&
          !!profile &&
          profile.capacity !== null &&
          profile.capacity >= filter.capacity_min;
      }

      if (
        filter.capacity_max !== null &&
        filter.capacity_max !== undefined &&
        Number.isFinite(filter.capacity_max)
      ) {
        matches =
          matches &&
          !!profile &&
          profile.capacity !== null &&
          profile.capacity <= filter.capacity_max;
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
