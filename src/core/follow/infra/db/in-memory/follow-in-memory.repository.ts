import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Follow, FollowId } from "../../../domain/follow.aggregate";
import {
  FollowFilter,
  FollowSearchParams,
  FollowSearchResult,
  IFollowRepository,
} from "../../../domain/follow.repository";
import { FollowTarget } from "../../../domain/follow-types";

export class FollowInMemoryRepository
  extends InMemorySearchableRepository<Follow, FollowId, FollowFilter>
  implements IFollowRepository
{
  sortableFields: string[] = ["created_at"];

  getEntity(): new (...args: any[]) => Follow {
    return Follow;
  }

  async findByAudienceAndTarget(
    params: { audience_id: string } & FollowTarget,
  ): Promise<Follow | null> {
    return (
      this.items.find(
        (f) =>
          f.audience_id === params.audience_id &&
          f.target_type === params.target_type &&
          f.target_id === params.target_id,
      ) ?? null
    );
  }

  async countByTarget(target: FollowTarget): Promise<number> {
    return this.items.filter(
      (f) =>
        f.target_type === target.target_type &&
        f.target_id === target.target_id,
    ).length;
  }

  async listNotifiableFollowerIds(params: {
    targets: FollowTarget[];
    after: string | null;
    limit: number;
  }): Promise<string[]> {
    if (!params.targets.length) return [];
    const ids = new Set<string>();
    for (const f of this.items) {
      if (!f.notifications_enabled) continue;
      const matches = params.targets.some(
        (t) => t.target_type === f.target_type && t.target_id === f.target_id,
      );
      if (matches) ids.add(f.audience_id);
    }
    return [...ids]
      .sort()
      .filter((id) => (params.after ? id > params.after : true))
      .slice(0, params.limit);
  }

  async search(props: FollowSearchParams): Promise<FollowSearchResult> {
    const result = await super.search(props);
    return new FollowSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Follow[],
    filter: FollowFilter | null,
  ): Promise<Follow[]> {
    if (!filter) return items;
    return items.filter(
      (f) =>
        (filter.audience_id ? f.audience_id === filter.audience_id : true) &&
        (filter.target_type ? f.target_type === filter.target_type : true) &&
        (filter.target_id ? f.target_id === filter.target_id : true),
    );
  }

  protected applySort(
    items: Follow[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): Follow[] {
    return super.applySort(items, sort ?? "created_at", sort_dir ?? "desc");
  }
}
