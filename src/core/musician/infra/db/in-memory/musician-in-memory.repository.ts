import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import {
  IMusicianRepository,
  MusicianFilter,
  MusicianIdentity,
  MusicianSearchParams,
  MusicianSearchResult,
} from "../../../domain/musician.repository";
import { publicDistanceKm } from "../../../domain/musician-location-privacy";

/** Distância na grade pública: base ou turnê vigente, o que estiver mais perto. */
function distanceFromOrigin(
  musician: Musician,
  origin: { lat: number; lng: number },
): number | null {
  const profile = musician.profile;
  return publicDistanceKm(origin, [
    profile?.location,
    profile?.isTouring ? profile.touring_location : null,
  ]);
}

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

  async findByCnpj(cnpj: string): Promise<Musician | null> {
    return this.items.find((m) => m.cnpj?.value === cnpj) ?? null;
  }

  async findByPhone(phone: string): Promise<Musician | null> {
    return this.items.find((m) => m.phone?.value === phone) ?? null;
  }

  async findIdentitiesByIds(ids: MusicianId[]): Promise<MusicianIdentity[]> {
    const wanted = new Set(ids.map((id) => id.id));
    return this.items
      .filter((musician) => wanted.has(musician.musician_id.id))
      .map((musician) => ({
        id: musician.musician_id.id,
        name: musician.name,
        stage_name: musician.stage_name,
        avatar: musician.avatar,
        instruments: musician.instruments,
        genres: musician.genres,
        rating: musician.rating.value,
        total_ratings: musician.total_ratings,
        is_verified: musician.is_verified,
      }));
  }

  async search(props: MusicianSearchParams): Promise<MusicianSearchResult> {
    const result = await super.search(props);
    const filter = props.filter;
    const distances = new Map<string, number>();

    // Espelho do Prisma: com origem (`lat`+`lng`), cada item ganha a sua
    // distância — com ou sem raio.
    if (
      filter?.lat !== null &&
      filter?.lat !== undefined &&
      filter?.lng !== null &&
      filter?.lng !== undefined
    ) {
      const origin = { lat: filter.lat, lng: filter.lng };
      for (const musician of result.items) {
        const distance = distanceFromOrigin(musician, origin);
        if (distance !== null) {
          distances.set(musician.musician_id.id, distance);
        }
      }
    }

    return new MusicianSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
      distances,
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

      // `Array.isArray` sem `length`: lista vazia significa "nenhum id" e tem
      // de zerar o resultado, nunca desaparecer do filtro. Mesma razão do
      // `where.id = { in: [] }` no repositório Prisma.
      if (Array.isArray(filter.ids)) {
        matches = matches && filter.ids.includes(musician.musician_id.id);
      }

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

      // Espelho do Prisma: `q` casa com o artístico OU com o de cadastro.
      if (filter.q) {
        const term = filter.q.toLowerCase();
        matches =
          matches &&
          (musician.name.toLowerCase().includes(term) ||
            (musician.stage_name?.toLowerCase().includes(term) ?? false));
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
      // 🔴 Medido na grade pública, como no Prisma: a coordenada exata nunca
      // decide quem entra no raio.
      if (
        filter.lat !== null &&
        filter.lat !== undefined &&
        filter.lng !== null &&
        filter.lng !== undefined &&
        filter.radius_km !== null &&
        filter.radius_km !== undefined
      ) {
        const distance = distanceFromOrigin(musician, {
          lat: filter.lat,
          lng: filter.lng,
        });
        matches = matches && distance !== null && distance <= filter.radius_km;
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
