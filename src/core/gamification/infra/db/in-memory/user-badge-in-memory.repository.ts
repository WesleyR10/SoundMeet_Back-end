import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { UserBadge, UserBadgeId } from "../../../domain/user-badge.aggregate";
import { BadgeType } from "../../../../shared/domain/value-objects/badge.vo";
import {
  UserBadgeFilter,
  UserBadgeSearchParams,
  UserBadgeSearchResult,
  IUserBadgeRepository,
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

  async findByUserIdAndBadgeType(
    user_id: string,
    badge_type: BadgeType,
  ): Promise<UserBadge | null> {
    const badge = this.items.find(
      (item) => item.user_id.id === user_id && item.badge.type === badge_type,
    );
    return badge || null;
  }

  async findByBadgeType(badge_type: BadgeType): Promise<UserBadge[]> {
    return this.items.filter((item) => item.badge.type === badge_type);
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

      if (filter.badge_type && item.badge.type !== filter.badge_type) {
        return false;
      }

      if (
        filter.badge_category &&
        item.badge.category !== filter.badge_category
      ) {
        return false;
      }

      if (filter.badge_rarity && item.badge.rarity !== filter.badge_rarity) {
        return false;
      }

      if (
        filter.earned_at_gte &&
        item.earned_at &&
        item.earned_at < filter.earned_at_gte
      ) {
        return false;
      }

      if (
        filter.earned_at_lte &&
        item.earned_at &&
        item.earned_at > filter.earned_at_lte
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
