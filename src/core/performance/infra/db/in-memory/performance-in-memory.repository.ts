import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  Performance,
  PerformanceId,
} from "../../../domain/performance.aggregate";
import {
  IPerformanceRepository,
  PerformanceFilter,
  PerformanceSearchParams,
  PerformanceSearchResult,
} from "../../../domain/performance.repository";

export class PerformanceInMemoryRepository
  extends InMemorySearchableRepository<
    Performance,
    PerformanceId,
    PerformanceFilter
  >
  implements IPerformanceRepository
{
  sortableFields: string[] = ["started_at", "ended_at", "created_at"];

  getEntity(): new (...args: any[]) => Performance {
    return Performance;
  }

  async findLiveByEventAndMusician(params: {
    event_id: string;
    musician_id: string;
  }): Promise<Performance | null> {
    return (
      this.items.find(
        (p) =>
          p.event_id.id === params.event_id &&
          p.musician_id.id === params.musician_id &&
          p.status.isLive(),
      ) ?? null
    );
  }

  async findEndedByMusician(params: {
    musician_id: string;
    establishment_id?: string | null;
    limit?: number;
    started_from?: Date | null;
  }): Promise<Performance[]> {
    const items = this.items
      .filter(
        (p) =>
          p.musician_id.id === params.musician_id &&
          p.status.isEnded() &&
          (params.establishment_id
            ? p.establishment_id.id === params.establishment_id
            : true) &&
          (params.started_from
            ? p.started_at.getTime() >= params.started_from.getTime()
            : true),
      )
      .sort((a, b) => b.started_at.getTime() - a.started_at.getTime());

    return params.limit ? items.slice(0, params.limit) : items;
  }

  async countPlaysByMusicianAtEstablishment(params: {
    musician_id: string;
    establishment_id: string;
  }): Promise<
    Array<{
      music_library_id: string | null;
      title: string;
      artist: string;
      plays: number;
      last_played_at: Date;
    }>
  > {
    const buckets = new Map<
      string,
      {
        music_library_id: string | null;
        title: string;
        artist: string;
        plays: number;
        last_played_at: Date;
      }
    >();

    for (const performance of this.items) {
      if (performance.musician_id.id !== params.musician_id) continue;
      if (performance.establishment_id.id !== params.establishment_id) continue;

      for (const song of performance.songs) {
        // Agrupa por biblioteca quando existe; senão pelo par título+artista em
        // minúsculas, para "Evidências"/"evidencias" não virarem duas linhas.
        const key =
          song.music_library_id ??
          `${song.title.toLowerCase()}::${song.artist.toLowerCase()}`;

        const existing = buckets.get(key);
        if (existing) {
          existing.plays += 1;
          if (song.started_at > existing.last_played_at) {
            existing.last_played_at = song.started_at;
          }
          continue;
        }

        buckets.set(key, {
          music_library_id: song.music_library_id,
          title: song.title,
          artist: song.artist,
          plays: 1,
          last_played_at: song.started_at,
        });
      }
    }

    return Array.from(buckets.values()).sort((a, b) => b.plays - a.plays);
  }

  async countDistinctSongsByMusician(musician_id: string): Promise<number> {
    const keys = new Set<string>();

    for (const performance of this.items) {
      if (performance.musician_id.id !== musician_id) continue;
      for (const song of performance.songs) {
        keys.add(
          song.music_library_id ??
            `${song.title.toLowerCase()}::${song.artist.toLowerCase()}`,
        );
      }
    }

    return keys.size;
  }

  async search(
    props: PerformanceSearchParams,
  ): Promise<PerformanceSearchResult> {
    const result = await super.search(props);
    return new PerformanceSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Performance[],
    filter: PerformanceFilter | null,
  ): Promise<Performance[]> {
    if (!filter) return items;

    return items.filter((p) => {
      const byMusician = filter.musician_id
        ? p.musician_id.id === filter.musician_id
        : true;
      const byBand = filter.band_id ? p.band_id?.id === filter.band_id : true;
      const byEstablishment = filter.establishment_id
        ? p.establishment_id.id === filter.establishment_id
        : true;
      const byEvent = filter.event_id
        ? p.event_id.id === filter.event_id
        : true;
      const byStatus = filter.status ? p.status.value === filter.status : true;

      return byMusician && byBand && byEstablishment && byEvent && byStatus;
    });
  }

  protected applySort(
    items: Performance[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): Performance[] {
    // O show mais recente primeiro — é o que o músico procura ao abrir a lista.
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "started_at", "desc");
  }
}
