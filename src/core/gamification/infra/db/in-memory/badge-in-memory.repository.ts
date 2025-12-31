import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  Badge,
  BadgeCategory,
  BadgeId,
  BadgeRarity,
} from "../../../domain/badge.aggregate";
import {
  BadgeFilter,
  BadgeSearchParams,
  BadgeSearchResult,
  IBadgeRepository,
} from "../../../domain/badge.repository";

export class BadgeInMemoryRepository
  extends InMemorySearchableRepository<Badge, BadgeId, BadgeFilter>
  implements IBadgeRepository
{
  sortableFields: string[] = [
    "name",
    "category",
    "rarity",
    "points",
    "created_at",
  ];

  async search(props: BadgeSearchParams): Promise<BadgeSearchResult> {
    const result = await super.search(props);
    return new BadgeSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByCategory(category: BadgeCategory): Promise<Badge[]> {
    return this.items.filter((item) => item.category === category);
  }

  async findByRarity(rarity: BadgeRarity): Promise<Badge[]> {
    return this.items.filter((item) => item.rarity === rarity);
  }

  async findActiveByCategory(category: BadgeCategory): Promise<Badge[]> {
    return this.items.filter(
      (item) => item.category === category && item.is_active,
    );
  }

  protected async applyFilter(
    items: Badge[],
    filter: BadgeFilter,
  ): Promise<Badge[]> {
    if (!filter) {
      return items;
    }

    let filteredItems = items;

    if (filter.name) {
      filteredItems = filteredItems.filter((item) =>
        item.name.toLowerCase().includes(filter.name!.toLowerCase()),
      );
    }

    if (filter.category) {
      filteredItems = filteredItems.filter(
        (item) => item.category === filter.category,
      );
    }

    if (filter.rarity) {
      filteredItems = filteredItems.filter(
        (item) => item.rarity === filter.rarity,
      );
    }

    if (filter.is_active !== undefined) {
      filteredItems = filteredItems.filter(
        (item) => item.is_active === filter.is_active,
      );
    }

    // points_min/points_max não fazem parte de BadgeFilter; removidos para alinhar contrato

    return filteredItems;
  }

  getEntity(): new (...args: any[]) => Badge {
    return Badge;
  }
}
