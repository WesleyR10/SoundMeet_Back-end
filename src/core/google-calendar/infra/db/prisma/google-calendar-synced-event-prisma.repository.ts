import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  GoogleCalendarSyncedEvent,
  GoogleCalendarSyncedEventId,
} from "../../../domain/google-calendar-synced-event.aggregate";
import { IGoogleCalendarSyncedEventRepository } from "../../../domain/google-calendar-synced-event.repository";
import { GoogleCalendarSyncedEventModelMapper } from "./google-calendar-synced-event-model-mapper";

export class GoogleCalendarSyncedEventPrismaRepository implements IGoogleCalendarSyncedEventRepository {
  constructor(
    private prisma: PrismaClient,
    private readonly uow?: IUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private get client(): PrismaClient | Prisma.TransactionClient {
    return this.uow?.getTransaction() ?? this.prisma;
  }

  async insert(entity: GoogleCalendarSyncedEvent): Promise<void> {
    const modelProps = GoogleCalendarSyncedEventModelMapper.toModel(entity);
    try {
      await this.client.googleCalendarSyncedEvent.create({
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.synced_event_id.id,
        operation: "googleCalendarSyncedEvent.create",
      });
    }
  }

  async bulkInsert(entities: GoogleCalendarSyncedEvent[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      GoogleCalendarSyncedEventModelMapper.toModel(entity),
    );
    try {
      await this.client.googleCalendarSyncedEvent.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "googleCalendarSyncedEvent.createMany",
      });
    }
  }

  async update(entity: GoogleCalendarSyncedEvent): Promise<void> {
    const modelProps = GoogleCalendarSyncedEventModelMapper.toModel(entity);
    try {
      await this.client.googleCalendarSyncedEvent.update({
        where: { id: entity.synced_event_id.id },
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.synced_event_id.id,
        operation: "googleCalendarSyncedEvent.update",
      });
    }
  }

  async delete(entity_id: GoogleCalendarSyncedEventId): Promise<void> {
    try {
      await this.client.googleCalendarSyncedEvent.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "googleCalendarSyncedEvent.delete",
      });
    }
  }

  async findById(
    entity_id: GoogleCalendarSyncedEventId,
  ): Promise<GoogleCalendarSyncedEvent | null> {
    const model = await this.client.googleCalendarSyncedEvent.findUnique({
      where: { id: entity_id.id },
    });
    return model ? GoogleCalendarSyncedEventModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<GoogleCalendarSyncedEvent[]> {
    const models = await this.client.googleCalendarSyncedEvent.findMany();
    return models.map((model) =>
      GoogleCalendarSyncedEventModelMapper.toEntity(model),
    );
  }

  async findByIds(
    ids: GoogleCalendarSyncedEventId[],
  ): Promise<GoogleCalendarSyncedEvent[]> {
    const models = await this.client.googleCalendarSyncedEvent.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((m) => GoogleCalendarSyncedEventModelMapper.toEntity(m));
  }

  async existsById(ids: GoogleCalendarSyncedEventId[]): Promise<{
    exists: GoogleCalendarSyncedEventId[];
    not_exists: GoogleCalendarSyncedEventId[];
  }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.client.googleCalendarSyncedEvent.findMany(
      {
        where: { id: { in: ids.map((id) => id.id) } },
        select: { id: true },
      },
    );

    const existingIds = existingModels.map((m) => m.id);
    return {
      exists: ids.filter((id) => existingIds.includes(id.id)),
      not_exists: ids.filter((id) => !existingIds.includes(id.id)),
    };
  }

  async findByBookingId(
    booking_id: string,
  ): Promise<GoogleCalendarSyncedEvent | null> {
    const model = await this.client.googleCalendarSyncedEvent.findUnique({
      where: { bookingId: booking_id },
    });
    return model ? GoogleCalendarSyncedEventModelMapper.toEntity(model) : null;
  }

  async upsert(entity: GoogleCalendarSyncedEvent): Promise<void> {
    const modelProps = GoogleCalendarSyncedEventModelMapper.toModel(entity);
    try {
      await this.client.googleCalendarSyncedEvent.upsert({
        where: { bookingId: entity.booking_id.id },
        create: modelProps,
        update: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.synced_event_id.id,
        operation: "googleCalendarSyncedEvent.upsert",
      });
    }
  }

  getEntity(): new (...args: any[]) => GoogleCalendarSyncedEvent {
    return GoogleCalendarSyncedEvent;
  }
}
