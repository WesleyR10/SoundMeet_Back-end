import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  UserInteraction,
  UserInteractionId,
} from "../../../domain/user-interaction.aggregate";
import {
  IUserInteractionRepository,
  UserInteractionFilter,
  UserInteractionSearchParams,
  UserInteractionSearchResult,
} from "../../../domain/user-interaction.repository";

export class UserInteractionInMemoryRepository
  extends InMemorySearchableRepository<
    UserInteraction,
    UserInteractionId,
    UserInteractionFilter
  >
  implements IUserInteractionRepository
{
  sortableFields: string[] = [
    "interaction_type",
    "points_earned",
    "created_at",
  ];

  async search(
    props: UserInteractionSearchParams,
  ): Promise<UserInteractionSearchResult> {
    const result = await super.search(props);
    return new UserInteractionSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByUserId(user_id: string): Promise<UserInteraction[]> {
    return this.items.filter((item) => item.user_id.id === user_id);
  }

  async findByInteractionType(
    interaction_type: string,
  ): Promise<UserInteraction[]> {
    return this.items.filter(
      (item) => item.interaction_type === interaction_type,
    );
  }

  async findByUserIdAndType(
    user_id: string,
    interaction_type: string,
  ): Promise<UserInteraction[]> {
    return this.items.filter(
      (item) =>
        item.user_id.id === user_id &&
        item.interaction_type === interaction_type,
    );
  }

  async findByDateRange(
    start_date: Date,
    end_date: Date,
  ): Promise<UserInteraction[]> {
    return this.items.filter(
      (item) => item.created_at >= start_date && item.created_at <= end_date,
    );
  }

  async getTotalPointsByUserId(user_id: string): Promise<number> {
    const userInteractions = this.items.filter(
      (item) => item.user_id.id === user_id,
    );
    return userInteractions.reduce(
      (total, interaction) => total + interaction.points_earned,
      0,
    );
  }

  async getInteractionCountByType(interaction_type: string): Promise<number> {
    return this.items.filter(
      (item) => item.interaction_type === interaction_type,
    ).length;
  }

  protected async applyFilter(
    items: UserInteraction[],
    filter: UserInteractionFilter,
  ): Promise<UserInteraction[]> {
    if (!filter) {
      return items;
    }

    let filteredItems = items;

    if (filter.user_id) {
      filteredItems = filteredItems.filter(
        (item) => item.user_id.id === filter.user_id,
      );
    }

    if (filter.interaction_type) {
      filteredItems = filteredItems.filter(
        (item) => item.interaction_type === filter.interaction_type,
      );
    }

    if (filter.target_id) {
      filteredItems = filteredItems.filter(
        (item) => item.target_id === filter.target_id,
      );
    }

    if (filter.points_earned_min !== undefined) {
      filteredItems = filteredItems.filter(
        (item) => item.points_earned >= filter.points_earned_min!,
      );
    }

    if (filter.points_earned_max !== undefined) {
      filteredItems = filteredItems.filter(
        (item) => item.points_earned <= filter.points_earned_max!,
      );
    }

    if (filter.start_date) {
      filteredItems = filteredItems.filter(
        (item) => item.created_at >= filter.start_date!,
      );
    }

    if (filter.end_date) {
      filteredItems = filteredItems.filter(
        (item) => item.created_at <= filter.end_date!,
      );
    }

    return filteredItems;
  }

  getEntity(): new (...args: any[]) => UserInteraction {
    return UserInteraction;
  }
}
