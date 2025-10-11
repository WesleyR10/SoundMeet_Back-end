import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Ranking, RankingId } from "../../../domain/ranking.aggregate";
import {
  RankingFilter,
  RankingSearchParams,
  RankingSearchResult,
  IRankingRepository,
} from "../../../domain/ranking.repository";

export class RankingInMemoryRepository
  extends InMemorySearchableRepository<Ranking, RankingId, RankingFilter>
  implements IRankingRepository
{
  async search(props: RankingSearchParams): Promise<RankingSearchResult> {
    const result = await super.search(props);
    return new RankingSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  sortableFields: string[] = [
    "position",
    "score",
    "created_at",
    "period_start",
  ];

  protected async applyFilter(
    items: Ranking[],
    filter: RankingFilter | null,
  ): Promise<Ranking[]> {
    if (!filter) {
      return items;
    }

    const filtered = items.filter((ranking) => {
      let matches = true;

      if (filter.user_id) {
        matches = matches && ranking.user_id === filter.user_id;
      }

      if (filter.ranking_type) {
        matches = matches && ranking.ranking_type === filter.ranking_type;
      }

      if (filter.period) {
        matches = matches && ranking.period === filter.period;
      }

      return matches;
    });

    return filtered;
  }

  getEntity(): new (...args: any[]) => Ranking {
    return Ranking;
  }

  protected applySort(
    items: Ranking[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "position", "asc");
  }
}
