import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import {
  AudienceFilter,
  AudienceSearchParams,
  AudienceSearchResult,
  IAudienceRepository,
} from "../../../domain/audience.repository";

export class AudienceInMemoryRepository
  extends InMemorySearchableRepository<Audience, AudienceId, AudienceFilter>
  implements IAudienceRepository
{
  async search(props: AudienceSearchParams): Promise<AudienceSearchResult> {
    const result = await super.search(props);
    return new AudienceSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  sortableFields: string[] = [
    "name",
    "created_at",
    "totalPoints",
    "currentLevel",
  ];

  protected async applyFilter(
    items: Audience[],
    filter: AudienceFilter | null,
  ): Promise<Audience[]> {
    if (!filter) {
      return items;
    }

    return items.filter((audience) => {
      let matches = true;

      if (filter.name) {
        const nameMatch = audience.name
          .toLowerCase()
          .includes(filter.name.toLowerCase());
        matches = matches && nameMatch;
      }

      if (filter.email) {
        const emailMatch = audience.emailValue
          .toLowerCase()
          .includes(filter.email.toLowerCase());
        matches = matches && emailMatch;
      }

      if (filter.is_active !== undefined) {
        matches = matches && audience.is_active === filter.is_active;
      }

      if (filter.favorite_genres && filter.favorite_genres.length > 0) {
        const genreMatch = filter.favorite_genres.some((genre) =>
          audience.favorite_genres.includes(genre),
        );
        matches = matches && genreMatch;
      }

      if (
        filter.favorite_instruments &&
        filter.favorite_instruments.length > 0
      ) {
        const instrumentMatch = filter.favorite_instruments.some((instrument) =>
          audience.favorite_instruments.includes(instrument),
        );
        matches = matches && instrumentMatch;
      }

      if (filter.min_level !== null && filter.min_level !== undefined) {
        matches = matches && audience.currentLevel >= filter.min_level;
      }

      if (filter.min_points !== null && filter.min_points !== undefined) {
        matches = matches && audience.totalPoints >= filter.min_points;
      }

      return matches;
    });
  }

  getEntity(): new (...args: any[]) => Audience {
    return Audience;
  }

  protected applySort(
    items: Audience[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    if (!sort || !this.sortableFields.includes(sort)) {
      // Ordenar por created_at por padrão quando sort é null
      return [...items].sort((a, b) => {
        const aValue = a.created_at.getTime();
        const bValue = b.created_at.getTime();
        return aValue - bValue; // Ordem crescente (mais antigo primeiro)
      });
    }

    return super.applySort(items, sort, sort_dir);
  }

  // Métodos específicos do domínio Audience
  async findByEmail(email: string): Promise<Audience | null> {
    return (
      this.items.find(
        (item) => item.emailValue.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  }

  async findActiveAudiences(): Promise<Audience[]> {
    return this.items.filter((audience) => audience.is_active);
  }

  async findByGenrePreference(genre: string): Promise<Audience[]> {
    return this.items.filter(
      (audience) =>
        audience.is_active && audience.favorite_genres?.includes(genre),
    );
  }

  async getAudienceStats(): Promise<{
    total_audiences: number;
    active_audiences: number;
    inactive_audiences: number;
  }> {
    const totalAudiences = this.items.length;
    const activeAudiences = this.items.filter((a) => a.is_active).length;
    const inactiveAudiences = totalAudiences - activeAudiences;

    return {
      total_audiences: totalAudiences,
      active_audiences: activeAudiences,
      inactive_audiences: inactiveAudiences,
    };
  }

  // Gamification methods
  async findTopFans(limit: number = 10): Promise<Audience[]> {
    return this.items
      .filter((audience) => audience.is_active)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);
  }

  async findByLevel(level: number): Promise<Audience[]> {
    return this.items.filter((audience) => audience.currentLevel === level);
  }
}
