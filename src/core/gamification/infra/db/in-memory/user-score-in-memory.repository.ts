import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { UserScore, UserScoreId } from "../../../domain/user-score.aggregate";
import {
  IUserScoreRepository,
  UserScoreFilter,
  UserScoreSearchParams,
  UserScoreSearchResult,
} from "../../../domain/user-score.repository";

export class UserScoreInMemoryRepository
  extends InMemorySearchableRepository<UserScore, UserScoreId, UserScoreFilter>
  implements IUserScoreRepository
{
  async search(props: UserScoreSearchParams): Promise<UserScoreSearchResult> {
    const result = await super.search(props);
    return new UserScoreSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  sortableFields: string[] = ["points", "created_at", "score_type"];

  protected async applyFilter(
    items: UserScore[],
    filter: UserScoreFilter | null,
  ): Promise<UserScore[]> {
    if (!filter) {
      return items;
    }

    const filtered = items.filter((userScore) => {
      let matches = true;

      if (filter.user_id) {
        matches = matches && userScore.user_id.id === filter.user_id;
      }

      if (filter.score_type) {
        matches = matches && userScore.score_type.value === filter.score_type;
      }

      if (filter.reference_id) {
        matches = matches && userScore.reference_id === filter.reference_id;
      }

      return matches;
    });

    return filtered;
  }

  async findByUserAndType(
    user_id: string,
    score_type: string,
  ): Promise<UserScore[]> {
    return this.items.filter(
      (item) =>
        item.user_id.id === user_id && item.score_type.value === score_type,
    );
  }

  async getTotalPointsByUser(user_id: string): Promise<number> {
    return this.items
      .filter((item) => item.user_id.id === user_id)
      .reduce((total, item) => total + item.points, 0);
  }

  async getPointsByUserAndType(
    user_id: string,
    score_type: string,
  ): Promise<number> {
    return this.items
      .filter(
        (item) =>
          item.user_id.id === user_id && item.score_type.value === score_type,
      )
      .reduce((total, item) => total + item.points, 0);
  }

  getEntity(): new (...args: any[]) => UserScore {
    return UserScore;
  }

  protected applySort(
    items: UserScore[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
