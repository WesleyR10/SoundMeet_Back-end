import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Request, RequestId } from "../../../domain/request.aggregate";
import {
  IRequestRepository,
  RequestFilter,
  RequestSearchParams,
  RequestSearchResult,
} from "../../../domain/request.repository";

export class RequestInMemoryRepository
  extends InMemorySearchableRepository<Request, RequestId, RequestFilter>
  implements IRequestRepository
{
  sortableFields: string[] = [
    "created_at",
    "responded_at",
    "song_title",
    "artist",
    "priority",
    "points_value",
  ];

  async search(props: RequestSearchParams): Promise<RequestSearchResult> {
    const result = await super.search(props);
    return new RequestSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Request[],
    filter: RequestFilter | null,
  ): Promise<Request[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      let matches = true;

      if (filter.audience_id && item.audience_id.id !== filter.audience_id) {
        matches = false;
      }

      if (filter.event_id && item.event_id.id !== filter.event_id) {
        matches = false;
      }

      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        matches = false;
      }

      if (filter.status && item.status.value !== filter.status) {
        matches = false;
      }

      if (
        filter.song_title &&
        !item.song_title.value
          .toLowerCase()
          .includes(filter.song_title.toLowerCase())
      ) {
        matches = false;
      }

      if (
        filter.artist &&
        item.artist &&
        !item.artist.toLowerCase().includes(filter.artist.toLowerCase())
      ) {
        matches = false;
      }

      if (filter.created_after && item.created_at < filter.created_after) {
        matches = false;
      }

      if (filter.created_before && item.created_at > filter.created_before) {
        matches = false;
      }

      return matches;
    });
  }

  getEntity(): new (...args: any[]) => Request {
    return Request;
  }

  protected applySort(
    items: Request[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(
          items,
          sort,
          sort_dir,
          (sort: string, item: Request) => {
            if (sort === "priority") {
              return item.priority;
            }
            if (sort === "points_value") {
              return item.pointsValue;
            }
            if (sort === "song_title") {
              return item.song_title.value;
            }
            if (sort === "artist") {
              return item.artist || "";
            }
            return item[sort];
          },
        )
      : super.applySort(items, "created_at", "desc");
  }

  async findByAudienceId(audience_id: string): Promise<Request[]> {
    return this.items.filter((item) => item.audience_id.id === audience_id);
  }

  async findByMusicianId(musician_id: string): Promise<Request[]> {
    return this.items.filter((item) => item.musician_id.id === musician_id);
  }

  async findPendingRequests(musician_id?: string): Promise<Request[]> {
    return this.items.filter((item) => {
      const isPending = item.isPending;
      if (musician_id) {
        return isPending && item.musician_id.id === musician_id;
      }
      return isPending;
    });
  }

  async findPendingRequestsByMusician(musician_id: string): Promise<Request[]> {
    return this.items.filter(
      (item) => item.isPending && item.musician_id.id === musician_id,
    );
  }

  async findAcceptedRequestsByMusician(
    musician_id: string,
  ): Promise<Request[]> {
    return this.items.filter(
      (item) => item.isAccepted && item.musician_id.id === musician_id,
    );
  }

  async findRejectedRequestsByMusician(
    musician_id: string,
  ): Promise<Request[]> {
    return this.items.filter(
      (item) => item.isRejected && item.musician_id.id === musician_id,
    );
  }

  async findRequestsByAudienceAndMusician(
    audience_id: string,
    musician_id: string,
    event_id?: string,
  ): Promise<Request[]> {
    return this.items.filter(
      (item) =>
        item.audience_id.id === audience_id &&
        item.musician_id.id === musician_id &&
        (!event_id || item.event_id.id === event_id),
    );
  }

  async findPendingRequestsByAudienceAndMusician(
    audience_id: string,
    musician_id: string,
    event_id?: string,
  ): Promise<Request[]> {
    return this.items.filter(
      (item) =>
        item.audience_id.id === audience_id &&
        item.musician_id.id === musician_id &&
        item.isPending &&
        (!event_id || item.event_id.id === event_id),
    );
  }

  async countRequestsByAudienceToday(audience_id: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.countRequestsByAudienceInPeriod(audience_id, today, tomorrow);
  }

  async countRequestsByAudienceInPeriod(
    audience_id: string,
    start_date: Date,
    end_date: Date,
  ): Promise<number> {
    return this.items.filter(
      (item) =>
        item.audience_id.id === audience_id &&
        item.created_at >= start_date &&
        item.created_at < end_date,
    ).length;
  }

  async countRequestsByAudienceInPeriodForEvent(
    audience_id: string,
    event_id: string,
    start_date: Date,
    end_date: Date,
  ): Promise<number> {
    return this.items.filter(
      (item) =>
        item.audience_id.id === audience_id &&
        item.event_id.id === event_id &&
        item.created_at >= start_date &&
        item.created_at < end_date,
    ).length;
  }

  async countPendingRequestsByMusician(musician_id: string): Promise<number> {
    return this.items.filter(
      (item) => item.isPending && item.musician_id.id === musician_id,
    ).length;
  }

  async findRecentRequestsByAudience(
    audience_id: string,
    hours_limit: number = 2,
  ): Promise<Request[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours_limit);

    return this.items
      .filter(
        (item) =>
          item.audience_id.id === audience_id && item.created_at >= cutoffTime,
      )
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async findPopularSongs(
    musician_id?: string,
    limit: number = 10,
  ): Promise<{ song_title: string; artist?: string; count: number }[]> {
    const filteredItems = musician_id
      ? this.items.filter((item) => item.musician_id.id === musician_id)
      : this.items;

    const songCounts = new Map<
      string,
      { song_title: string; artist?: string; count: number }
    >();

    filteredItems.forEach((item) => {
      const key = `${item.song_title.value}|${item.artist || ""}`;
      if (songCounts.has(key)) {
        songCounts.get(key)!.count++;
      } else {
        songCounts.set(key, {
          song_title: item.song_title.value,
          artist: item.artist || undefined,
          count: 1,
        });
      }
    });

    return Array.from(songCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}
