import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { BookingStatusEnum } from "../../../../shared/domain/value-objects/booking-status.vo";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import {
  BookingFilter,
  BookingSearchParams,
  BookingSearchResult,
  IBookingRepository,
} from "../../../domain/booking.repository";
import { BookingModelMapper, BookingModelProps } from "./booking-model-mapper";

export class BookingPrismaRepository implements IBookingRepository {
  sortableFields: string[] = [
    "created_at",
    "updated_at",
    "start_at",
    "end_at",
    "status",
  ];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Booking): Promise<void> {
    const modelProps = BookingModelMapper.toModel(entity);
    await this.prisma.booking.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: Booking[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      BookingModelMapper.toModel(entity),
    );
    await this.prisma.booking.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Booking): Promise<void> {
    const id = entity.id.id;
    const modelProps = BookingModelMapper.toModel(entity);

    try {
      await this.prisma.booking.update({
        where: { id },
        data: modelProps,
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id, this.getEntity());
      }
      throw error;
    }
  }

  async delete(entity_id: BookingId): Promise<void> {
    const id = entity_id.id;
    try {
      await this.prisma.booking.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id, this.getEntity());
      }
      throw error;
    }
  }

  async findById(entity_id: BookingId): Promise<Booking | null> {
    const model = await this.prisma.booking.findUnique({
      where: { id: entity_id.id },
    });
    return model ? BookingModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: BookingId[]): Promise<Booking[]> {
    const models = await this.prisma.booking.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => BookingModelMapper.toEntity(m as any));
  }

  async findAll(): Promise<Booking[]> {
    const models = await this.prisma.booking.findMany();
    return models.map((m) => BookingModelMapper.toEntity(m as any));
  }

  async existsById(
    ids: BookingId[],
  ): Promise<{ exists: BookingId[]; not_exists: BookingId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.booking.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => new BookingId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(props: BookingSearchParams): Promise<BookingSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const items = models.map((m) => BookingModelMapper.toEntity(m as any));

    return new BookingSearchResult({
      items,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findConfirmedInRangeByMusician(
    musician_id: string,
    start: Date,
    end: Date,
  ): Promise<Booking[]> {
    const rows = await this.prisma.$queryRaw<BookingModelProps[]>`
      SELECT *
      FROM "bookings"
      WHERE "status" = 'confirmed'
        AND "musicianId" = ${musician_id}
        AND ("start_at" - ("buffer_minutes" * INTERVAL '1 minute')) < ${end}
        AND ("end_at" + ("buffer_minutes" * INTERVAL '1 minute')) > ${start}
    `;
    return rows.map((row) => BookingModelMapper.toEntity(row));
  }

  async findConfirmedInRangeByBand(
    band_id: string,
    start: Date,
    end: Date,
  ): Promise<Booking[]> {
    const rows = await this.prisma.$queryRaw<BookingModelProps[]>`
      SELECT *
      FROM "bookings"
      WHERE "status" = 'confirmed'
        AND "bandId" = ${band_id}
        AND ("start_at" - ("buffer_minutes" * INTERVAL '1 minute')) < ${end}
        AND ("end_at" + ("buffer_minutes" * INTERVAL '1 minute')) > ${start}
    `;
    return rows.map((row) => BookingModelMapper.toEntity(row));
  }

  async findPendingExpired(now: Date): Promise<Booking[]> {
    const models = await this.prisma.booking.findMany({
      where: {
        status: "pending",
        expires_at: {
          not: null,
          lte: now,
        },
      },
    });
    return models.map((m) => BookingModelMapper.toEntity(m as any));
  }

  async expirePendingExpired(now: Date): Promise<number> {
    const result = await this.prisma.booking.updateMany({
      where: {
        status: "pending",
        expires_at: {
          not: null,
          lte: now,
        },
      },
      data: {
        status: "expired",
        updated_at: now,
      },
    });
    return result.count;
  }

  async updateWithStatus(
    entity: Booking,
    expected_statuses: BookingStatusEnum[],
  ): Promise<boolean> {
    const modelProps = BookingModelMapper.toModel(entity);
    const result = await this.prisma.booking.updateMany({
      where: {
        id: entity.id.id,
        status: {
          in: expected_statuses,
        },
      },
      data: modelProps,
    });
    return result.count === 1;
  }

  private buildWhereClause(filter?: BookingFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.establishment_id)
      where.establishmentId = filter.establishment_id;
    if (filter.musician_id) where.musicianId = filter.musician_id;
    if (filter.band_id) where.bandId = filter.band_id;
    if (filter.event_id) where.eventId = filter.event_id;
    if (filter.status) where.status = `${filter.status}`;

    if (filter.start_at_gte || filter.start_at_lte) {
      where.start_at = {
        ...(filter.start_at_gte && { gte: filter.start_at_gte }),
        ...(filter.start_at_lte && { lte: filter.start_at_lte }),
      };
    }

    if (filter.end_at_gte || filter.end_at_lte) {
      where.end_at = {
        ...(filter.end_at_gte && { gte: filter.end_at_gte }),
        ...(filter.end_at_lte && { lte: filter.end_at_lte }),
      };
    }

    return where;
  }

  private buildOrderByClause(sort?: string | null, sort_dir?: string | null) {
    if (!sort) {
      return { created_at: "desc" as const };
    }

    if (!this.sortableFields.includes(sort)) {
      throw new InvalidArgumentError(`Invalid sort field: ${sort}`);
    }

    return {
      [sort]: sort_dir === "asc" ? ("asc" as const) : ("desc" as const),
    };
  }

  getEntity(): new (...args: any[]) => Booking {
    return Booking;
  }
}
