import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../domain/music-library.aggregate";
import {
  IMusicLibraryRepository,
  MusicLibraryFilter,
  MusicLibrarySearchParams,
  MusicLibrarySearchResult,
  SearchSongCatalogInput,
  SongCatalogEntry,
} from "../../../domain/music-library.repository";

export class MusicLibraryInMemoryRepository
  extends InMemorySearchableRepository<
    MusicLibrary,
    MusicLibraryId,
    MusicLibraryFilter
  >
  implements IMusicLibraryRepository
{
  sortableFields: string[] = [
    "title",
    "artist",
    "difficulty",
    "created_at",
    "updated_at",
  ];

  async search(
    props: MusicLibrarySearchParams,
  ): Promise<MusicLibrarySearchResult> {
    const result = await super.search(props);
    return new MusicLibrarySearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: MusicLibrary[],
    filter: MusicLibraryFilter | null,
  ): Promise<MusicLibrary[]> {
    if (!filter) {
      return items;
    }

    return items.filter((entity) => {
      let matches = true;

      if (filter.musician_id) {
        matches = matches && entity.musician_id.id === filter.musician_id;
      }

      if (filter.title) {
        matches =
          matches &&
          entity.title.toLowerCase().includes(filter.title.toLowerCase());
      }

      if (filter.artist) {
        matches =
          matches &&
          entity.artist.toLowerCase().includes(filter.artist.toLowerCase());
      }

      if (filter.genre) {
        matches =
          matches &&
          (entity.genre?.toLowerCase().includes(filter.genre.toLowerCase()) ??
            false);
      }

      if (filter.key) {
        matches =
          matches && entity.key?.toLowerCase() === filter.key.toLowerCase();
      }

      if (filter.source) {
        matches =
          matches &&
          (entity.source?.toLowerCase().includes(filter.source.toLowerCase()) ??
            false);
      }

      if (
        filter.difficulty !== null &&
        filter.difficulty !== undefined &&
        Number.isFinite(filter.difficulty)
      ) {
        matches = matches && entity.difficulty === filter.difficulty;
      }

      if (filter.is_favorite !== null && filter.is_favorite !== undefined) {
        matches = matches && entity.is_favorite === filter.is_favorite;
      }

      return matches;
    });
  }

  async findPendingSpotifyResolution(limit: number): Promise<MusicLibrary[]> {
    return this.items
      .filter((item) => item.spotify_checked_at === null)
      .slice(0, Math.max(0, limit));
  }

  /**
   * Espelha a agregação do Postgres: agrupa por (título, artista) NORMALIZADOS
   * — minúsculas e sem espaço nas pontas —, senão "Garota de Ipanema" e
   * "garota de ipanema " viram duas entradas do catálogo.
   */
  async searchSongCatalog(
    input: SearchSongCatalogInput,
  ): Promise<SongCatalogEntry[]> {
    const term = input.term?.trim().toLocaleLowerCase("pt-BR") ?? "";

    const matches = this.items.filter((item) => {
      if (input.scope === "repertoire") {
        // A biblioteca do próprio músico entra inteira: é o que ele toca,
        // tenha a plataforma cifrado ou não.
        if (item.musician_id.id !== input.musician_id) return false;
      } else if (!item.hasChordSheetContent()) {
        return false;
      }
      if (!term) return true;
      return (
        item.title.toLocaleLowerCase("pt-BR").includes(term) ||
        item.artist.toLocaleLowerCase("pt-BR").includes(term)
      );
    });

    const grouped = new Map<
      string,
      SongCatalogEntry & { musicians: Set<string> }
    >();

    for (const item of matches) {
      const key = `${item.title.trim().toLocaleLowerCase("pt-BR")}\u0000${item.artist
        .trim()
        .toLocaleLowerCase("pt-BR")}`;
      const isOwn = item.musician_id.id === input.musician_id;
      const entry = grouped.get(key);

      if (!entry) {
        grouped.set(key, {
          title: item.title.trim(),
          artist: item.artist.trim(),
          genre: item.genre,
          musicians_count: 0,
          library_id: isOwn ? item.entity_id.id : null,
          musicians: new Set<string>(),
        });
      }

      const current = grouped.get(key)!;
      current.musicians.add(item.musician_id.id);
      current.musicians_count = current.musicians.size;
      current.genre = current.genre ?? item.genre;
      // A linha do músico alvo vence qualquer outra: é a única que pode virar
      // `library_id` do pedido.
      if (isOwn) current.library_id = item.entity_id.id;
    }

    return Array.from(grouped.values())
      .sort(
        (a, b) =>
          Number(b.library_id !== null) - Number(a.library_id !== null) ||
          b.musicians_count - a.musicians_count ||
          a.title.localeCompare(b.title, "pt-BR"),
      )
      .slice(0, Math.max(0, input.limit))
      .map(({ musicians: _musicians, ...entry }) => entry);
  }

  getEntity(): new (...args: any[]) => MusicLibrary {
    return MusicLibrary;
  }

  protected applySort(
    items: MusicLibrary[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
