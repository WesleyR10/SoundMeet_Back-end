import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Ranking, RankingId } from "../../../domain/ranking.aggregate";
import {
  IRankingRepository,
  RankingFilter,
  RankingSearchParams,
  RankingSearchResult,
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
        matches = matches && ranking.user_id.id === filter.user_id;
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

  async findByUserAndEstablishment(
    user_id: string,
    establishment_id: string,
    period_type: string,
  ): Promise<Ranking | null> {
    const matches = this.items
      .filter(
        (item) =>
          item.user_id.id === user_id &&
          item.establishment_id?.id === establishment_id &&
          item.ranking_type === period_type,
      )
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return matches[0] ?? null;
  }

  async findByUserAndTypeAndPeriod(
    user_id: string,
    ranking_type: string,
    period: string,
    period_start: Date,
    period_end: Date,
  ): Promise<Ranking | null> {
    const ranking = this.items.find(
      (item) =>
        item.user_id.id === user_id &&
        item.ranking_type === ranking_type &&
        item.period === period &&
        item.period_start.getTime() === period_start.getTime() &&
        item.period_end.getTime() === period_end.getTime(),
    );
    return ranking || null;
  }

  async findTopRankings(
    establishment_id: string,
    period_type: string,
    limit?: number,
  ): Promise<Ranking[]> {
    const items = this.items
      .filter(
        (item) =>
          item.establishment_id?.id === establishment_id &&
          item.ranking_type === period_type,
      )
      .sort((a, b) => b.score - a.score);

    return items.slice(0, limit ?? 10);
  }

  async findCurrentRankings(
    ranking_type: string,
    period: string,
  ): Promise<Ranking[]> {
    return this.items.filter(
      (item) =>
        item.ranking_type === ranking_type &&
        item.period === period &&
        item.isCurrentPeriod(),
    );
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
