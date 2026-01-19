import { Prisma, PrismaClient } from "@prisma/client";

import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
} from "../../../domain/establishment-analytics.entity";
import {
  EstablishmentAnalyticsDailyMetrics,
  EstablishmentAnalyticsSearchParams,
  EstablishmentAnalyticsSearchResult,
  IEstablishmentAnalyticsRepository,
} from "../../../domain/establishment-analytics.repository";
import { EstablishmentAnalyticsModelMapper } from "./establishment-analytics-model-mapper";

const toUtcDateOnly = (date: Date): Date => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

const addUtcDays = (date: Date, days: number): Date => {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

export class EstablishmentAnalyticsPrismaRepository implements IEstablishmentAnalyticsRepository {
  sortableFields: string[] = [
    "date",
    "events_hosted",
    "total_attendees",
    "musicians_hired",
    "total_spent",
    "avg_rating",
    "created_at",
  ];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: EstablishmentAnalytics): Promise<void> {
    const model = EstablishmentAnalyticsModelMapper.toModel(entity);
    await this.prismaClient.establishmentAnalytics.create({
      data: {
        id: model.id,
        establishmentId: model.establishmentId,
        date: toUtcDateOnly(model.date),
        eventsHosted: model.eventsHosted,
        totalAttendees: model.totalAttendees,
        musiciansHired: model.musiciansHired,
        totalSpent: model.totalSpent,
        avgRating: model.avgRating,
        created_at: model.created_at,
      },
    });
  }

  async bulkInsert(entities: EstablishmentAnalytics[]): Promise<void> {
    const models = entities.map((e) =>
      EstablishmentAnalyticsModelMapper.toModel(e),
    );
    await this.prismaClient.establishmentAnalytics.createMany({
      data: models.map((m) => ({
        id: m.id,
        establishmentId: m.establishmentId,
        date: toUtcDateOnly(m.date),
        eventsHosted: m.eventsHosted,
        totalAttendees: m.totalAttendees,
        musiciansHired: m.musiciansHired,
        totalSpent: m.totalSpent,
        avgRating: m.avgRating,
        created_at: m.created_at,
      })),
    });
  }

  async update(entity: EstablishmentAnalytics): Promise<void> {
    const model = EstablishmentAnalyticsModelMapper.toModel(entity);
    try {
      await this.prismaClient.establishmentAnalytics.update({
        where: { id: entity.analytics_id.id },
        data: {
          establishmentId: model.establishmentId,
          date: toUtcDateOnly(model.date),
          eventsHosted: model.eventsHosted,
          totalAttendees: model.totalAttendees,
          musiciansHired: model.musiciansHired,
          totalSpent: model.totalSpent,
          avgRating: model.avgRating,
          created_at: model.created_at,
        },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(entity.analytics_id.id, EstablishmentAnalytics);
      }
      throw error;
    }
  }

  async delete(entity_id: EstablishmentAnalyticsId): Promise<void> {
    try {
      await this.prismaClient.establishmentAnalytics.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(entity_id.id, EstablishmentAnalytics);
      }
      throw error;
    }
  }

  async findById(
    entity_id: EstablishmentAnalyticsId,
  ): Promise<EstablishmentAnalytics | null> {
    const model = await this.prismaClient.establishmentAnalytics.findUnique({
      where: { id: entity_id.id },
    });
    return model
      ? EstablishmentAnalyticsModelMapper.toEntity(model as any)
      : null;
  }

  async findAll(): Promise<EstablishmentAnalytics[]> {
    const models = await this.prismaClient.establishmentAnalytics.findMany();
    return models.map((m) =>
      EstablishmentAnalyticsModelMapper.toEntity(m as any),
    );
  }

  async findByIds(
    ids: EstablishmentAnalyticsId[],
  ): Promise<EstablishmentAnalytics[]> {
    const models = await this.prismaClient.establishmentAnalytics.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) =>
      EstablishmentAnalyticsModelMapper.toEntity(m as any),
    );
  }

  async existsById(ids: EstablishmentAnalyticsId[]): Promise<{
    exists: EstablishmentAnalyticsId[];
    not_exists: EstablishmentAnalyticsId[];
  }> {
    const existingModels =
      await this.prismaClient.establishmentAnalytics.findMany({
        where: { id: { in: ids.map((i) => i.id) } },
        select: { id: true },
      });

    const existingIds = existingModels.map((m) => m.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));
    return { exists, not_exists };
  }

  getEntity(): new (...args: any[]) => EstablishmentAnalytics {
    return EstablishmentAnalytics;
  }

  async search(
    props: EstablishmentAnalyticsSearchParams,
  ): Promise<EstablishmentAnalyticsSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where: any = {};
    if (props.filter) {
      if (props.filter.establishment_id) {
        where.establishmentId = props.filter.establishment_id;
      }
      if (props.filter.date_gte || props.filter.date_lte) {
        where.date = {
          ...(props.filter.date_gte && {
            gte: toUtcDateOnly(props.filter.date_gte),
          }),
          ...(props.filter.date_lte && {
            lte: toUtcDateOnly(props.filter.date_lte),
          }),
        };
      }
    }

    const sortFieldMap: Record<string, string> = {
      events_hosted: "eventsHosted",
      total_attendees: "totalAttendees",
      musicians_hired: "musiciansHired",
      total_spent: "totalSpent",
      avg_rating: "avgRating",
    };

    const sortField = props.sort
      ? (sortFieldMap[props.sort] ?? props.sort)
      : null;

    const orderBy: Prisma.EstablishmentAnalyticsOrderByWithRelationInput =
      sortField
        ? ({
            [sortField]: (props.sort_dir ?? "asc") as Prisma.SortOrder,
          } as any)
        : { date: "desc" };

    const [models, total] = await Promise.all([
      this.prismaClient.establishmentAnalytics.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy,
      }),
      this.prismaClient.establishmentAnalytics.count({ where }),
    ]);

    return new EstablishmentAnalyticsSearchResult({
      items: models.map((m) =>
        EstablishmentAnalyticsModelMapper.toEntity(m as any),
      ),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async upsertDaily(
    entity: EstablishmentAnalytics,
  ): Promise<EstablishmentAnalytics> {
    const model = EstablishmentAnalyticsModelMapper.toModel(entity);
    const date = toUtcDateOnly(model.date);

    const upserted = await this.prismaClient.establishmentAnalytics.upsert({
      where: {
        establishmentId_date: {
          establishmentId: model.establishmentId,
          date,
        },
      },
      create: {
        id: model.id,
        establishmentId: model.establishmentId,
        date,
        eventsHosted: model.eventsHosted,
        totalAttendees: model.totalAttendees,
        musiciansHired: model.musiciansHired,
        totalSpent: model.totalSpent,
        avgRating: model.avgRating,
        created_at: model.created_at,
      },
      update: {
        eventsHosted: model.eventsHosted,
        totalAttendees: model.totalAttendees,
        musiciansHired: model.musiciansHired,
        totalSpent: model.totalSpent,
        avgRating: model.avgRating,
      },
    });

    return EstablishmentAnalyticsModelMapper.toEntity(upserted as any);
  }

  async findByEstablishmentAndDate(
    establishment_id: string,
    date: Date,
  ): Promise<EstablishmentAnalytics | null> {
    const model = await this.prismaClient.establishmentAnalytics.findUnique({
      where: {
        establishmentId_date: {
          establishmentId: establishment_id,
          date: toUtcDateOnly(date),
        },
      },
    });
    return model
      ? EstablishmentAnalyticsModelMapper.toEntity(model as any)
      : null;
  }

  async calculateDailyMetrics(
    establishment_id: string,
    date: Date,
  ): Promise<EstablishmentAnalyticsDailyMetrics> {
    const day = toUtcDateOnly(date);
    const nextDay = addUtcDays(day, 1);

    const [eventsHosted, totalAttendees, bookings, bookingAgg, establishment] =
      await Promise.all([
        this.prismaClient.event.count({
          where: {
            establishmentId: establishment_id,
            date: { gte: day, lt: nextDay },
            status: { not: "cancelled" },
          },
        }),
        this.prismaClient.eventAttendee.count({
          where: {
            event: {
              establishmentId: establishment_id,
              date: { gte: day, lt: nextDay },
            },
          },
        }),
        this.prismaClient.booking.findMany({
          where: {
            establishmentId: establishment_id,
            status: { in: ["confirmed", "completed"] },
            start_at: { gte: day, lt: nextDay },
          },
          select: { musicianId: true, bandId: true, fee: true },
        }),
        this.prismaClient.booking.aggregate({
          where: {
            establishmentId: establishment_id,
            status: { in: ["confirmed", "completed"] },
            start_at: { gte: day, lt: nextDay },
          },
          _sum: { fee: true },
        }),
        this.prismaClient.establishment.findUnique({
          where: { id: establishment_id },
          select: { rating: true },
        }),
      ]);

    const distinct = new Set<string>();
    for (const b of bookings) {
      if (b.musicianId) {
        distinct.add(`musician:${b.musicianId}`);
      }
      if (b.bandId) {
        distinct.add(`band:${b.bandId}`);
      }
    }

    return {
      date: day,
      events_hosted: eventsHosted,
      total_attendees: totalAttendees,
      musicians_hired: distinct.size,
      total_spent: bookingAgg._sum.fee ?? 0,
      avg_rating: establishment?.rating ?? 0,
    };
  }
}
