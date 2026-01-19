import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { Event, EventId } from "../../../domain";
import {
  EventFilter,
  EventSearchParams,
  EventSearchResult,
  IEventRepository,
} from "../../../domain";
import { EventModelMapper } from "./event-model-mapper";

export class EventPrismaRepository implements IEventRepository {
  sortableFields: string[] = ["date", "startTime", "created_at", "name"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Event): Promise<void> {
    const modelProps = EventModelMapper.toModel(entity);
    await this.prisma.event.create({
      data: {
        id: modelProps.id,
        establishmentId: modelProps.establishmentId,
        name: modelProps.name,
        description: modelProps.description,
        date: modelProps.date,
        startTime: modelProps.startTime,
        endTime: modelProps.endTime,
        status: modelProps.status,
        maxCapacity: modelProps.maxCapacity,
        currentCapacity: modelProps.currentCapacity,
        isPublic: modelProps.isPublic,
        coverCharge: modelProps.coverCharge,
        created_at: modelProps.created_at,
        updated_at: modelProps.updated_at,
      },
    });
  }

  async bulkInsert(entities: Event[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      EventModelMapper.toModel(entity),
    );
    await this.prisma.event.createMany({
      data: modelsProps.map((m) => ({
        id: m.id,
        establishmentId: m.establishmentId,
        name: m.name,
        description: m.description,
        date: m.date,
        startTime: m.startTime,
        endTime: m.endTime,
        status: m.status,
        maxCapacity: m.maxCapacity,
        currentCapacity: m.currentCapacity,
        isPublic: m.isPublic,
        coverCharge: m.coverCharge,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
    });
  }

  async update(entity: Event): Promise<void> {
    const id = entity.event_id.id;
    const modelProps = EventModelMapper.toModel(entity);
    try {
      await this.prisma.event.update({
        where: { id },
        data: {
          name: modelProps.name,
          description: modelProps.description,
          date: modelProps.date,
          startTime: modelProps.startTime,
          endTime: modelProps.endTime,
          status: modelProps.status,
          maxCapacity: modelProps.maxCapacity,
          currentCapacity: modelProps.currentCapacity,
          isPublic: modelProps.isPublic,
          coverCharge: modelProps.coverCharge,
          updated_at: modelProps.updated_at,
        },
      });
    } catch (e: any) {
      if (e?.code === "P2025") {
        throw new NotFoundError(id, Event);
      }
      throw e;
    }
  }

  async delete(id: EventId): Promise<void> {
    try {
      await this.prisma.event.delete({ where: { id: id.id } });
    } catch (e: any) {
      if (e?.code === "P2025") {
        throw new NotFoundError(id.id, Event);
      }
      throw e;
    }
  }

  async findById(id: EventId): Promise<Event | null> {
    const model = await this.prisma.event.findUnique({ where: { id: id.id } });
    return model ? EventModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: EventId[]): Promise<Event[]> {
    const models = await this.prisma.event.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });

    return models.map((model) => EventModelMapper.toEntity(model as any));
  }

  async findAll(): Promise<Event[]> {
    const models = await this.prisma.event.findMany();
    return models.map((m) => EventModelMapper.toEntity(m as any));
  }

  async search(props: EventSearchParams): Promise<EventSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    const items = models.map((model) =>
      EventModelMapper.toEntity(model as any),
    );

    return new EventSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async existsById(
    ids: EventId[],
  ): Promise<{ exists: EventId[]; not_exists: EventId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.event.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: {
        id: true,
      },
    });

    const existingIds = existingModels.map((m) => new EventId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existing) => existing.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async addAttendee(event_id: EventId, audience_id: string): Promise<void> {
    const event = await this.findById(event_id);
    if (!event) {
      throw new NotFoundError(event_id.id, Event);
    }

    const existing = await this.prisma.eventAttendee.findUnique({
      where: {
        eventId_audienceId: {
          eventId: event_id.id,
          audienceId: audience_id,
        },
      },
      select: { is_active: true },
    });

    if (existing?.is_active) {
      return;
    }

    event.addAttendee();
    if (event.notification.hasErrors()) {
      throw new InvalidArgumentError(
        JSON.stringify(event.notification.toJSON()),
      );
    }

    await this.prisma.$transaction([
      this.prisma.eventAttendee.upsert({
        where: {
          eventId_audienceId: {
            eventId: event_id.id,
            audienceId: audience_id,
          },
        },
        update: {
          is_active: true,
          leftAt: null,
        },
        create: {
          eventId: event_id.id,
          audienceId: audience_id,
        },
      }),
      this.prisma.event.update({
        where: { id: event_id.id },
        data: {
          currentCapacity: event.current_capacity,
          updated_at: event.updated_at,
        },
      }),
    ]);
  }

  async removeAttendee(event_id: EventId, audience_id: string): Promise<void> {
    const event = await this.findById(event_id);
    if (!event) {
      throw new NotFoundError(event_id.id, Event);
    }

    const existing = await this.prisma.eventAttendee.findUnique({
      where: {
        eventId_audienceId: {
          eventId: event_id.id,
          audienceId: audience_id,
        },
      },
      select: { is_active: true },
    });

    if (!existing) {
      throw new NotFoundError(audience_id, Event);
    }

    if (!existing.is_active) {
      return;
    }

    event.removeAttendee();
    if (event.notification.hasErrors()) {
      throw new InvalidArgumentError(
        JSON.stringify(event.notification.toJSON()),
      );
    }

    await this.prisma.$transaction([
      this.prisma.eventAttendee.update({
        where: {
          eventId_audienceId: {
            eventId: event_id.id,
            audienceId: audience_id,
          },
        },
        data: {
          is_active: false,
          leftAt: new Date(),
        },
      }),
      this.prisma.event.update({
        where: { id: event_id.id },
        data: {
          currentCapacity: event.current_capacity,
          updated_at: event.updated_at,
        },
      }),
    ]);
  }

  async isAudienceAttendee(
    event_id: EventId,
    audience_id: string,
  ): Promise<boolean> {
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: {
        eventId_audienceId: {
          eventId: event_id.id,
          audienceId: audience_id,
        },
      },
      select: { is_active: true },
    });
    return Boolean(attendee?.is_active);
  }

  async addPerformer(
    event_id: EventId,
    performer: {
      musician_id?: string | null;
      band_id?: string | null;
      fee?: number | null;
      status?: string;
      start_at?: Date | null;
      end_at?: Date | null;
    },
  ): Promise<void> {
    const event = await this.findById(event_id);
    if (!event) {
      throw new NotFoundError(event_id.id, Event);
    }

    if (!performer.musician_id && !performer.band_id) {
      throw new InvalidArgumentError("musician_id or band_id is required");
    }

    const where = {
      eventId: event_id.id,
      ...(performer.musician_id
        ? { musicianId: performer.musician_id }
        : { bandId: performer.band_id! }),
    };

    const existing = await this.prisma.eventMusician.findFirst({
      where,
      select: { id: true },
    });

    if (existing) {
      await this.prisma.eventMusician.update({
        where: { id: existing.id },
        data: {
          fee: performer.fee ?? null,
          status: performer.status ?? "confirmed",
          startTime: performer.start_at ?? null,
          endTime: performer.end_at ?? null,
        },
      });
      return;
    }

    await this.prisma.eventMusician.create({
      data: {
        eventId: event_id.id,
        musicianId: performer.musician_id ?? null,
        bandId: performer.band_id ?? null,
        fee: performer.fee ?? null,
        status: performer.status ?? "confirmed",
        startTime: performer.start_at ?? null,
        endTime: performer.end_at ?? null,
      },
    });
  }

  async removePerformer(
    event_id: EventId,
    event_musician_id: string,
  ): Promise<void> {
    const exists = await this.prisma.eventMusician.findFirst({
      where: { id: event_musician_id, eventId: event_id.id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError(event_musician_id, Event);
    }
    await this.prisma.eventMusician.delete({
      where: { id: event_musician_id },
    });
  }

  async removePerformerByTarget(
    event_id: EventId,
    target: {
      musician_id?: string | null;
      band_id?: string | null;
    },
  ): Promise<void> {
    if (!target.musician_id && !target.band_id) {
      throw new InvalidArgumentError("musician_id or band_id is required");
    }

    await this.prisma.eventMusician.deleteMany({
      where: {
        eventId: event_id.id,
        ...(target.musician_id
          ? { musicianId: target.musician_id }
          : { bandId: target.band_id! }),
      },
    });
  }

  async isMusicianPerformer(
    event_id: EventId,
    musician_id: string,
  ): Promise<boolean> {
    const performer = await this.prisma.eventMusician.findFirst({
      where: {
        eventId: event_id.id,
        musicianId: musician_id,
        status: { not: "cancelled" },
      },
      select: { id: true },
    });
    return !!performer;
  }

  getEntity(): new (...args: any[]) => Event {
    return Event;
  }

  private buildWhereClause(filter: EventFilter | null): Prisma.EventWhereInput {
    if (!filter) return {};

    const where: Prisma.EventWhereInput = {};
    if (filter.establishment_id) {
      where.establishmentId = filter.establishment_id;
    }
    if (filter.status) {
      where.status = String(filter.status);
    }
    if (filter.date_gte || filter.date_lte) {
      where.date = {
        ...(filter.date_gte && { gte: filter.date_gte }),
        ...(filter.date_lte && { lte: filter.date_lte }),
      };
    }
    if (filter.is_public !== null && filter.is_public !== undefined) {
      where.isPublic = filter.is_public;
    }

    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    const direction = (sort_dir ?? "desc") as Prisma.SortOrder;
    if (!sort) {
      return { created_at: "desc" as Prisma.SortOrder };
    }

    if (!this.sortableFields.includes(sort)) {
      throw new InvalidArgumentError(`Invalid sort field: ${sort}`);
    }

    if (sort === "date") {
      return { date: direction };
    }
    if (sort === "startTime") {
      return { startTime: direction };
    }

    return { [sort]: direction } as any;
  }
}
