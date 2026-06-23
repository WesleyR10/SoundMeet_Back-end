import { Prisma, PrismaClient } from "@prisma/client";

import { Uuid } from "../../../../shared/domain";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { EventAttendee, EventAttendeeId } from "../../../domain";
import {
  EventAttendeeFilter,
  EventAttendeeSearchParams,
  EventAttendeeSearchResult,
  IEventAttendeeRepository,
} from "../../../domain";
import { EventAttendeeModelMapper } from "./event-attendee-model.mapper";

export class EventAttendeePrismaRepository implements IEventAttendeeRepository {
  sortableFields: string[] = ["joinedAt", "leftAt"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: EventAttendee): Promise<void> {
    const modelProps = EventAttendeeModelMapper.toModel(entity);
    try {
      await this.prisma.eventAttendee.create({
        data: {
          id: modelProps.id,
          eventId: modelProps.eventId,
          audienceId: modelProps.audienceId,
          joinedAt: modelProps.joinedAt,
          leftAt: modelProps.leftAt,
          is_active: modelProps.is_active,
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: EventAttendee,
        id: entity.event_attendee_id.id,
        operation: "eventAttendee.create",
      });
    }
  }

  async bulkInsert(entities: EventAttendee[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      EventAttendeeModelMapper.toModel(entity),
    );
    try {
      await this.prisma.eventAttendee.createMany({
        data: modelsProps.map((m) => ({
          id: m.id,
          eventId: m.eventId,
          audienceId: m.audienceId,
          joinedAt: m.joinedAt,
          leftAt: m.leftAt,
          is_active: m.is_active,
        })),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: EventAttendee,
        operation: "eventAttendee.createMany",
      });
    }
  }

  async update(entity: EventAttendee): Promise<void> {
    const id = entity.event_attendee_id.id;
    const modelProps = EventAttendeeModelMapper.toModel(entity);
    try {
      await this.prisma.eventAttendee.update({
        where: { id },
        data: {
          joinedAt: modelProps.joinedAt,
          leftAt: modelProps.leftAt,
          is_active: modelProps.is_active,
        },
      });
    } catch (e: any) {
      throw mapPrismaErrorToDomainError(e, {
        entityClass: EventAttendee,
        id,
        operation: "eventAttendee.update",
      });
    }
  }

  async delete(id: EventAttendeeId): Promise<void> {
    try {
      await this.prisma.eventAttendee.delete({ where: { id: id.id } });
    } catch (e: any) {
      throw mapPrismaErrorToDomainError(e, {
        entityClass: EventAttendee,
        id: id.id,
        operation: "eventAttendee.delete",
      });
    }
  }

  async findById(id: EventAttendeeId): Promise<EventAttendee | null> {
    const model = await this.prisma.eventAttendee.findUnique({
      where: { id: id.id },
    });
    return model ? EventAttendeeModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: EventAttendeeId[]): Promise<EventAttendee[]> {
    const models = await this.prisma.eventAttendee.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((model) =>
      EventAttendeeModelMapper.toEntity(model as any),
    );
  }

  async findAll(): Promise<EventAttendee[]> {
    const models = await this.prisma.eventAttendee.findMany();
    return models.map((m) => EventAttendeeModelMapper.toEntity(m as any));
  }

  async findByEventAndAudience(
    event_id: Uuid,
    audience_id: Uuid,
  ): Promise<EventAttendee | null> {
    const model = await this.prisma.eventAttendee.findUnique({
      where: {
        eventId_audienceId: {
          eventId: event_id.id,
          audienceId: audience_id.id,
        },
      },
    });
    return model ? EventAttendeeModelMapper.toEntity(model as any) : null;
  }

  async findByEvent(event_id: Uuid): Promise<EventAttendee[]> {
    const models = await this.prisma.eventAttendee.findMany({
      where: { eventId: event_id.id },
    });
    return models.map((m) => EventAttendeeModelMapper.toEntity(m as any));
  }

  async search(
    props: EventAttendeeSearchParams,
  ): Promise<EventAttendeeSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.prisma.eventAttendee.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.eventAttendee.count({ where }),
    ]);

    const items = models.map((model) =>
      EventAttendeeModelMapper.toEntity(model as any),
    );

    return new EventAttendeeSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async existsById(
    ids: EventAttendeeId[],
  ): Promise<{ exists: EventAttendeeId[]; not_exists: EventAttendeeId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.eventAttendee.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => new EventAttendeeId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existing) => existing.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  getEntity(): new (...args: any[]) => EventAttendee {
    return EventAttendee;
  }

  private buildWhereClause(
    filter: EventAttendeeFilter | null,
  ): Prisma.EventAttendeeWhereInput {
    if (!filter) return {};

    const where: Prisma.EventAttendeeWhereInput = {};
    if (filter.event_id) {
      where.eventId = filter.event_id;
    }
    if (filter.audience_id) {
      where.audienceId = filter.audience_id;
    }
    if (filter.is_active !== null && filter.is_active !== undefined) {
      where.is_active = filter.is_active;
    }

    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    const direction = (sort_dir ?? "desc") as Prisma.SortOrder;
    if (!sort) {
      return { joinedAt: "desc" as Prisma.SortOrder };
    }

    if (!this.sortableFields.includes(sort)) {
      throw new InvalidArgumentError(`Invalid sort field: ${sort}`);
    }

    return { [sort]: direction } as any;
  }
}
