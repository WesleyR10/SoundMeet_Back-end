import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobId,
} from "../../../domain/synced-lyrics-bulk-job.aggregate";
import {
  ISyncedLyricsBulkJobRepository,
  SyncedLyricsBulkJobFilter,
  SyncedLyricsBulkJobSearchParams,
  SyncedLyricsBulkJobSearchResult,
} from "../../../domain/synced-lyrics-bulk-job.repository";

export class SyncedLyricsBulkJobInMemoryRepository
  extends InMemorySearchableRepository<
    SyncedLyricsBulkJob,
    SyncedLyricsBulkJobId,
    SyncedLyricsBulkJobFilter
  >
  implements ISyncedLyricsBulkJobRepository
{
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  async search(
    props: SyncedLyricsBulkJobSearchParams,
  ): Promise<SyncedLyricsBulkJobSearchResult> {
    const result = await super.search(props);
    return new SyncedLyricsBulkJobSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: SyncedLyricsBulkJob[],
    filter: SyncedLyricsBulkJobFilter | null,
  ): Promise<SyncedLyricsBulkJob[]> {
    if (!filter) return items;
    return items.filter((item) => {
      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        return false;
      }
      if (filter.status && item.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  getEntity(): new (...args: any[]) => SyncedLyricsBulkJob {
    return SyncedLyricsBulkJob;
  }
}
