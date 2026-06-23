import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
} from "../../../domain/establishment-analytics.read-model";
import {
  EstablishmentAnalyticsDailyMetrics,
  EstablishmentAnalyticsFilter,
  EstablishmentAnalyticsSearchParams,
  EstablishmentAnalyticsSearchResult,
  IEstablishmentAnalyticsRepository,
} from "../../../domain/establishment-analytics.repository";

const sameUtcDate = (left: Date, right: Date): boolean =>
  left.getUTCFullYear() === right.getUTCFullYear() &&
  left.getUTCMonth() === right.getUTCMonth() &&
  left.getUTCDate() === right.getUTCDate();

export class EstablishmentAnalyticsInMemoryRepository
  extends InMemorySearchableRepository<
    EstablishmentAnalytics,
    EstablishmentAnalyticsId,
    EstablishmentAnalyticsFilter
  >
  implements IEstablishmentAnalyticsRepository
{
  sortableFields: string[] = [
    "date",
    "events_hosted",
    "total_attendees",
    "musicians_hired",
    "total_spent",
    "avg_rating",
    "created_at",
  ];

  async search(
    props: EstablishmentAnalyticsSearchParams,
  ): Promise<EstablishmentAnalyticsSearchResult> {
    const result = await super.search(props);
    return new EstablishmentAnalyticsSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async upsertDaily(
    entity: EstablishmentAnalytics,
  ): Promise<EstablishmentAnalytics> {
    const existing = await this.findByEstablishmentAndDate(
      entity.establishment_id.id,
      entity.date,
    );

    if (existing) {
      existing.update({
        events_hosted: entity.events_hosted,
        total_attendees: entity.total_attendees,
        musicians_hired: entity.musicians_hired,
        total_spent: entity.total_spent,
        avg_rating: entity.avg_rating,
      });
      await this.update(existing);
      return existing;
    }

    await this.insert(entity);
    return entity;
  }

  async findByEstablishmentAndDate(
    establishment_id: string,
    date: Date,
  ): Promise<EstablishmentAnalytics | null> {
    return (
      this.items.find(
        (item) =>
          item.establishment_id.id === establishment_id &&
          sameUtcDate(item.date, date),
      ) ?? null
    );
  }

  async calculateDailyMetrics(
    establishment_id: string,
    date: Date,
  ): Promise<EstablishmentAnalyticsDailyMetrics> {
    const existing = await this.findByEstablishmentAndDate(
      establishment_id,
      date,
    );

    return {
      date,
      events_hosted: existing?.events_hosted ?? 0,
      total_attendees: existing?.total_attendees ?? 0,
      musicians_hired: existing?.musicians_hired ?? 0,
      total_spent: existing?.total_spent ?? 0,
      avg_rating: existing?.avg_rating ?? 0,
    };
  }

  protected async applyFilter(
    items: EstablishmentAnalytics[],
    filter: EstablishmentAnalyticsFilter | null,
  ): Promise<EstablishmentAnalytics[]> {
    if (!filter) return items;

    return items.filter((item) => {
      let matches = true;
      if (filter.establishment_id) {
        matches =
          matches && item.establishment_id.id === filter.establishment_id;
      }
      if (filter.date_gte) {
        matches = matches && item.date >= filter.date_gte;
      }
      if (filter.date_lte) {
        matches = matches && item.date <= filter.date_lte;
      }
      return matches;
    });
  }

  getEntity(): new (...args: any[]) => EstablishmentAnalytics {
    return EstablishmentAnalytics;
  }

  protected applySort(
    items: EstablishmentAnalytics[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "date", "desc");
  }
}
