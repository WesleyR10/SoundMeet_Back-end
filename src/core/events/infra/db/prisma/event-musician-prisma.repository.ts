import { Prisma, PrismaClient } from "@prisma/client";

import { Uuid } from "../../../../shared/domain";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { EventMusician, EventMusicianId } from "../../../domain";
import {
  EventMusicianFilter,
  EventMusicianSearchParams,
  EventMusicianSearchResult,
  IEventMusicianRepository,
} from "../../../domain";
import { EventMusicianModelMapper } from "./event-musician-model.mapper";

export class EventMusicianPrismaRepository implements IEventMusicianRepository {
  sortableFields: string[] = ["created_at", "status", "fee"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: EventMusician): Promise<void> {
    const modelProps = EventMusicianModelMapper.toModel(entity);
    try {
      await this.prisma.eventMusician.create({
        data: {
          id: modelProps.id,
          eventId: modelProps.eventId,
          musicianId: modelProps.musicianId,
          bandId: modelProps.bandId,
          fee: modelProps.fee,
          status: modelProps.status,
          startTime: modelProps.startTime,
          endTime: modelProps.endTime,
          created_at: modelProps.created_at,
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: EventMusician,
        id: entity.event_musician_id.id,
        operation: "eventMusician.create",
      });
    }
  }

  async bulkInsert(entities: EventMusician[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      EventMusicianModelMapper.toModel(entity),
    );
    try {
      await this.prisma.eventMusician.createMany({
        data: modelsProps.map((m) => ({
          id: m.id,
          eventId: m.eventId,
          musicianId: m.musicianId,
          bandId: m.bandId,
          fee: m.fee,
          status: m.status,
          startTime: m.startTime,
          endTime: m.endTime,
          created_at: m.created_at,
        })),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: EventMusician,
        operation: "eventMusician.createMany",
      });
    }
  }

  async update(entity: EventMusician): Promise<void> {
    const id = entity.event_musician_id.id;
    const modelProps = EventMusicianModelMapper.toModel(entity);
    try {
      await this.prisma.eventMusician.update({
        where: { id },
        data: {
          musicianId: modelProps.musicianId,
          bandId: modelProps.bandId,
          fee: modelProps.fee,
          status: modelProps.status,
          startTime: modelProps.startTime,
          endTime: modelProps.endTime,
        },
      });
    } catch (e: any) {
      throw mapPrismaErrorToDomainError(e, {
        entityClass: EventMusician,
        id,
        operation: "eventMusician.update",
      });
    }
  }

  async delete(id: EventMusicianId): Promise<void> {
    try {
      await this.prisma.eventMusician.delete({ where: { id: id.id } });
    } catch (e: any) {
      throw mapPrismaErrorToDomainError(e, {
        entityClass: EventMusician,
        id: id.id,
        operation: "eventMusician.delete",
      });
    }
  }

  async findById(id: EventMusicianId): Promise<EventMusician | null> {
    const model = await this.prisma.eventMusician.findUnique({
      where: { id: id.id },
    });
    return model ? EventMusicianModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: EventMusicianId[]): Promise<EventMusician[]> {
    const models = await this.prisma.eventMusician.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((model) =>
      EventMusicianModelMapper.toEntity(model as any),
    );
  }

  async findAll(): Promise<EventMusician[]> {
    const models = await this.prisma.eventMusician.findMany();
    return models.map((m) => EventMusicianModelMapper.toEntity(m as any));
  }

  async findByEvent(event_id: Uuid): Promise<EventMusician[]> {
    const models = await this.prisma.eventMusician.findMany({
      where: { eventId: event_id.id },
    });
    return models.map((m) => EventMusicianModelMapper.toEntity(m as any));
  }

  async search(
    props: EventMusicianSearchParams,
  ): Promise<EventMusicianSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.prisma.eventMusician.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.eventMusician.count({ where }),
    ]);

    const items = models.map((model) =>
      EventMusicianModelMapper.toEntity(model as any),
    );

    return new EventMusicianSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async existsById(
    ids: EventMusicianId[],
  ): Promise<{ exists: EventMusicianId[]; not_exists: EventMusicianId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.eventMusician.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => new EventMusicianId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existing) => existing.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  getEntity(): new (...args: any[]) => EventMusician {
    return EventMusician;
  }

  private buildWhereClause(
    filter: EventMusicianFilter | null,
  ): Prisma.EventMusicianWhereInput {
    if (!filter) return {};

    const where: Prisma.EventMusicianWhereInput = {};
    if (filter.event_id) {
      where.eventId = filter.event_id;
    }
    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }
    if (filter.band_id) {
      where.bandId = filter.band_id;
    }
    if (filter.status) {
      where.status = filter.status as Prisma.EventMusicianWhereInput["status"];
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

    return { [sort]: direction } as any;
  }
}
