import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  SyncedLyrics,
  SyncedLyricsId,
} from "../../../domain/synced-lyrics.aggregate";
import {
  ISyncedLyricsRepository,
  SyncedLyricsFilter,
  SyncedLyricsSearchParams,
  SyncedLyricsSearchResult,
} from "../../../domain/synced-lyrics.repository";

export class SyncedLyricsInMemoryRepository
  extends InMemorySearchableRepository<
    SyncedLyrics,
    SyncedLyricsId,
    SyncedLyricsFilter
  >
  implements ISyncedLyricsRepository
{
  sortableFields: string[] = [
    "created_at",
    "updated_at",
    "title",
    "artist",
    "lrc_version",
  ];

  async search(
    props: SyncedLyricsSearchParams,
  ): Promise<SyncedLyricsSearchResult> {
    const result = await super.search(props);
    return new SyncedLyricsSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: SyncedLyrics[],
    filter: SyncedLyricsFilter | null,
  ): Promise<SyncedLyrics[]> {
    if (!filter) return items;
    return items.filter((item) => {
      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        return false;
      }
      if (filter.query) {
        const q = String(filter.query).toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.artist.toLowerCase().includes(q);
        if (!matches) {
          return false;
        }
      }
      if (typeof filter.has_lrc === "boolean") {
        const hasLrc = item.lrc_raw !== null;
        if (hasLrc !== filter.has_lrc) {
          return false;
        }
      }
      if (filter.provider && item.lrc_provider !== filter.provider) {
        return false;
      }
      if (filter.hash && item.lrc_hash !== filter.hash) {
        return false;
      }
      return true;
    });
  }

  getEntity(): new (...args: any[]) => SyncedLyrics {
    return SyncedLyrics;
  }
}
