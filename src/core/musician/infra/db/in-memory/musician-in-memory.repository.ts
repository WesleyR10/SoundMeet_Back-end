import { haversineKm } from "../../../../shared/domain/geo.utils";
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

  async findByCpf(cpf: string): Promise<Musician | null> {
    return this.items.find((m) => m.cpf?.value === cpf) ?? null;
  }

  async findByPhone(phone: string): Promise<Musician | null> {
    return this.items.find((m) => m.phone?.value === phone) ?? null;
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

      // Mesma semântica do repositório Prisma: com price_model, o overlap
      // min/max é avaliado na faixa daquele modelo; sem, vale qualquer faixa.
      const priceRanges = musician.profile?.priceRanges ?? [];
      const candidateRanges = filter.price_model
        ? priceRanges.filter((range) => range.model === filter.price_model)
        : priceRanges;

      const hasPriceMin =
        filter.price_min !== null &&
        filter.price_min !== undefined &&
        Number.isFinite(filter.price_min);
      const hasPriceMax =
        filter.price_max !== null &&
        filter.price_max !== undefined &&
        Number.isFinite(filter.price_max);

      if (filter.price_model) {
        matches = matches && candidateRanges.length > 0;
      }

      if (filter.price_currency) {
        matches =
          matches &&
          priceRanges.some((range) => range.currency === filter.price_currency);
      }

      if (hasPriceMin || hasPriceMax) {
        matches =
          matches &&
          candidateRanges.some(
            (range) =>
              (!hasPriceMin || range.max >= filter.price_min!) &&
              (!hasPriceMax || range.min <= filter.price_max!),
          );
      }

      if (filter.is_active !== undefined) {
        matches = matches && musician.is_active === filter.is_active;
      }

      if (filter.is_verified !== undefined) {
        matches = matches && musician.is_verified === filter.is_verified;
      }

      if (filter.open_to_gigs !== undefined) {
        matches = matches && musician.open_to_gigs === filter.open_to_gigs;
      }

      // Busca por raio (7.13c) — espelho do Prisma: considera a base
      // permanente OU o turnê ainda ativo (7.13d), o que estiver dentro do
      // raio; nunca substitui a base, só amplia onde o músico é encontrado.
      if (
        filter.lat !== null &&
        filter.lat !== undefined &&
        filter.lng !== null &&
        filter.lng !== undefined &&
        filter.radius_km !== null &&
        filter.radius_km !== undefined
      ) {
        const location = musician.profile?.location ?? null;
        const withinHome =
          !!location &&
          location.latitude !== null &&
          location.latitude !== undefined &&
          location.longitude !== null &&
          location.longitude !== undefined &&
          haversineKm(filter.lat, filter.lng, location.latitude, location.longitude) <=
            filter.radius_km;

        const touringLocation = musician.profile?.touring_location ?? null;
        const withinTouring =
          !!touringLocation &&
          !!musician.profile?.isTouring &&
          touringLocation.latitude !== null &&
          touringLocation.latitude !== undefined &&
          touringLocation.longitude !== null &&
          touringLocation.longitude !== undefined &&
          haversineKm(
            filter.lat,
            filter.lng,
            touringLocation.latitude,
            touringLocation.longitude,
          ) <= filter.radius_km;

        matches = matches && (withinHome || withinTouring);
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
