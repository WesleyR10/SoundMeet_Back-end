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
