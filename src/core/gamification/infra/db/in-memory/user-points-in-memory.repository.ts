import { AudienceId, IAudienceRepository } from "../../../../audience";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  UserPoints,
  UserPointsId,
} from "../../../domain/user-points.aggregate";
import {
  IUserPointsRepository,
  UserPointsFilter,
  UserPointsLeaderboardEntry,
  UserPointsSearchParams,
  UserPointsSearchResult,
} from "../../../domain/user-points.repository";

export class UserPointsInMemoryRepository
  extends InMemorySearchableRepository<
    UserPoints,
    UserPointsId,
    UserPointsFilter
  >
  implements IUserPointsRepository
{
  sortableFields: string[] = ["total_points", "current_level", "created_at"];

  // Opcional: sem repo injetado, findTopUsersWithProfile devolve
  // nickname/avatar null (mesmo padrão de EventInMemoryRepository ↔
  // EstablishmentInMemoryRepository pra join cross-agregado em memória —
  // aqui é enriquecimento opcional, não crítico, então degrada em vez de
  // lançar quando o repo não é injetado).
  constructor(private readonly audienceRepo?: IAudienceRepository) {
    super();
  }

  async search(props: UserPointsSearchParams): Promise<UserPointsSearchResult> {
    const result = await super.search(props);
    return new UserPointsSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByUserId(user_id: string): Promise<UserPoints | null> {
    const userPoints = this.items.find((item) => item.user_id.id === user_id);
    return userPoints || null;
  }

  async findTopUsers(limit: number = 10): Promise<UserPoints[]> {
    return this.items
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, limit);
  }

  async findTopUsersWithProfile(
    limit: number = 10,
  ): Promise<UserPointsLeaderboardEntry[]> {
    const top = await this.findTopUsers(limit);
    return Promise.all(
      top.map(async (user_points) => {
        const audience = this.audienceRepo
          ? await this.audienceRepo.findById(
              new AudienceId(user_points.user_id.id),
            )
          : null;
        return {
          user_points,
          nickname: audience?.nickname ?? null,
          avatar: audience?.avatar ?? null,
        };
      }),
    );
  }

  async findByLevel(level: number): Promise<UserPoints[]> {
    return this.items.filter((item) => item.current_level === level);
  }

  protected async applyFilter(
    items: UserPoints[],
    filter: UserPointsFilter,
  ): Promise<UserPoints[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      if (filter.audienceId && item.user_id.id !== filter.audienceId) {
        return false;
      }

      if (
        filter.points_gte !== null &&
        filter.points_gte !== undefined &&
        item.total_points < filter.points_gte
      ) {
        return false;
      }

      if (
        filter.points_lte !== null &&
        filter.points_lte !== undefined &&
        item.total_points > filter.points_lte
      ) {
        return false;
      }

      // Removendo filtro por source pois não existe na entidade UserPoints
      // O campo source existe apenas no schema Prisma para rastreamento

      return true;
    });
  }

  getEntity(): new (...args: any[]) => UserPoints {
    return UserPoints;
  }

  protected applySort(
    items: UserPoints[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "total_points", "desc");
  }
}
