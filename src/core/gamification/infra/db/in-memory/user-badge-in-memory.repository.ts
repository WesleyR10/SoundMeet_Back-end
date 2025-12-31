import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { UserBadge, UserBadgeId } from "../../../domain/user-badge.aggregate";
import {
  IUserBadgeRepository,
  UserBadgeFilter,
  UserBadgeSearchParams,
  UserBadgeSearchResult,
} from "../../../domain/user-badge.repository";

export class UserBadgeInMemoryRepository
  extends InMemorySearchableRepository<UserBadge, UserBadgeId, UserBadgeFilter>
  implements IUserBadgeRepository
{
  sortableFields: string[] = ["earned_at", "points_earned", "created_at"];

  async search(props: UserBadgeSearchParams): Promise<UserBadgeSearchResult> {
    const result = await super.search(props);
    return new UserBadgeSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByUserId(user_id: string): Promise<UserBadge[]> {
    return this.items.filter((item) => item.user_id.id === user_id);
  }

  async findByUserAndBadgeType(
    user_id: string,
    badge_type: string,
  ): Promise<UserBadge | null> {
    const badge = this.items.find(
      (item) =>
        item.user_id.id === user_id && item.badge_type.value === badge_type,
    );
    return badge || null;
  }

  async findByBadgeType(badge_type: string): Promise<UserBadge[]> {
    return this.items.filter((item) => item.badge_type.value === badge_type);
  }

  async findUnlockedByUser(user_id: string): Promise<UserBadge[]> {
    return this.items.filter(
      (item) => item.user_id.id === user_id && item.is_unlocked,
    );
  }

  async findInProgressByUser(user_id: string): Promise<UserBadge[]> {
    return this.items.filter(
      (item) => item.user_id.id === user_id && !item.is_unlocked,
    );
  }

  protected async applyFilter(
    items: UserBadge[],
    filter: UserBadgeFilter,
  ): Promise<UserBadge[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      if (filter.user_id && item.user_id.id !== filter.user_id) {
        return false;
      }

      if (filter.badge_type && item.badge_type.value !== filter.badge_type) {
        return false;
      }

      if (
        filter.badge_category &&
        item.badge_type.value !== filter.badge_category // TODO: Implement category
      ) {
        return false;
      }

      if (
        filter.badge_rarity &&
        item.badge_type.value !== filter.badge_rarity
      ) {
        // TODO: Implement rarity
        return false;
      }

      if (
        filter.earned_at_gte &&
        item.unlocked_at &&
        item.unlocked_at < filter.earned_at_gte
      ) {
        return false;
      }

      if (
        filter.earned_at_lte &&
        item.unlocked_at &&
        item.unlocked_at > filter.earned_at_lte
      ) {
        return false;
      }

      return true;
    });
  }

  getEntity(): new (...args: any[]) => UserBadge {
    return UserBadge;
  }
}
