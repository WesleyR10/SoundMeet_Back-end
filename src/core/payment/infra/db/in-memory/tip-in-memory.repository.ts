import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  ITipRepository,
  TipFilter,
  TipSearchParams,
  TipSearchResult,
} from "../../../domain/repositories/tip.repository";
import { Tip, TipId } from "../../../domain/tip.aggregate";
import { TipStatus } from "../../../domain/tip-enums";

export class TipInMemoryRepository
  extends InMemorySearchableRepository<Tip, TipId, TipFilter>
  implements ITipRepository
{
  sortableFields: string[] = ["created_at"];

  async search(props: TipSearchParams): Promise<TipSearchResult> {
    const result = await super.search(props);
    return new TipSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  getEntity(): new (...args: any[]) => Tip {
    return Tip;
  }

  protected async applyFilter(
    items: Tip[],
    filter: TipFilter | null,
  ): Promise<Tip[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      if (filter.musician_id && item.musician_id?.id !== filter.musician_id) {
        return false;
      }
      if (filter.audience_id && item.audience_id.id !== filter.audience_id) {
        return false;
      }
      if (filter.event_id && item.event_id?.id !== filter.event_id) {
        return false;
      }
      if (filter.status && item.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  protected applySort(
    items: Tip[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }

  async findByMusicianId(musicianId: string): Promise<Tip[]> {
    return this.items.filter((item) => item.musician_id?.id === musicianId);
  }

  async sumCompletedByMusician(musician_id: string): Promise<number> {
    const cents = this.items
      .filter((item) => item.status === TipStatus.COMPLETED && item.musician_id?.id === musician_id)
      .reduce((acc, item) => acc + Math.round(item.amount.amount * 100), 0);
    return cents / 100;
  }

  async findCompletedByEvents(event_ids: string[]): Promise<Tip[]> {
    const wanted = new Set(event_ids);
    return this.items.filter(
      (item) =>
        item.status === TipStatus.COMPLETED &&
        !!item.event_id &&
        wanted.has(item.event_id.id),
    );
  }
}
