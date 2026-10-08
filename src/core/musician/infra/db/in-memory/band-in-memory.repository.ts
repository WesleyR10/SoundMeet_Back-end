import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Band, BandId, BandMemberStatus } from "../../../domain/band.aggregate";
import {
  BandFilter,
  BandSearchParams,
  BandSearchResult,
  IBandRepository,
} from "../../../domain/band.repository";
import { publicDistanceKm } from "../../../domain/musician-location-privacy";

export class BandInMemoryRepository
  extends InMemorySearchableRepository<Band, BandId, BandFilter>
  implements IBandRepository
{
  sortableFields: string[] = ["name", "created_at"];

  async findByMember(
    musician_id: Uuid,
    statuses: BandMemberStatus[],
  ): Promise<Band[]> {
    return this.items
      .filter((band) => {
        const member = band.findMember(musician_id);
        return !!member && statuses.includes(member.status);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

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

      // `some`, como o `hasSome` do Prisma: escolher dois gêneros traz quem
      // toca QUALQUER um deles. Com `every` o teste afirmava outra busca.
      if (filter.genres?.length) {
        matches = matches && filter.genres.some((g) => band.genres.includes(g));
      }

      const priceRange = band.priceRange;

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
        matches = matches && band.is_active === filter.is_active;
      }

      if (filter.open_to_gigs !== undefined) {
        matches = matches && band.open_to_gigs === filter.open_to_gigs;
      }

      if (filter.musician_id) {
        // "Minhas bandas" só deve listar bandas onde o vínculo é real — um
        // convite pending/declined não conta como "sou membro".
        matches =
          matches &&
          band.acceptedMembers.some(
            (m) => m.musician_id.id === filter.musician_id,
          );
      }

      // Busca por raio, medida na GRADE PÚBLICA — nunca na coordenada exata.
      // Ver `musician-location-privacy.ts`: com a posição precisa, mover a
      // origem e repetir acha o endereço da banda em poucas requisições.
      if (
        filter.lat !== null &&
        filter.lat !== undefined &&
        filter.lng !== null &&
        filter.lng !== undefined &&
        filter.radius_km !== null &&
        filter.radius_km !== undefined
      ) {
        const distance = publicDistanceKm(
          { lat: filter.lat, lng: filter.lng },
          [band.address],
        );
        matches = matches && distance !== null && distance <= filter.radius_km;
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
