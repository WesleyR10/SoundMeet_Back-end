import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  GoogleCalendarIntegration,
  GoogleCalendarIntegrationId,
} from "../../../domain/google-calendar-integration.aggregate";
import { IGoogleCalendarIntegrationRepository } from "../../../domain/google-calendar-integration.repository";
import { GoogleCalendarIntegrationModelMapper } from "./google-calendar-integration-model-mapper";

export class GoogleCalendarIntegrationPrismaRepository implements IGoogleCalendarIntegrationRepository {
  constructor(
    private prisma: PrismaClient,
    private readonly uow?: IUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private get client(): PrismaClient | Prisma.TransactionClient {
    return this.uow?.getTransaction() ?? this.prisma;
  }

  async insert(entity: GoogleCalendarIntegration): Promise<void> {
    const modelProps = GoogleCalendarIntegrationModelMapper.toModel(entity);
    try {
      await this.client.googleCalendarIntegration.create({
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.integration_id.id,
        operation: "googleCalendarIntegration.create",
      });
    }
  }

  async bulkInsert(entities: GoogleCalendarIntegration[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      GoogleCalendarIntegrationModelMapper.toModel(entity),
    );
    try {
      await this.client.googleCalendarIntegration.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "googleCalendarIntegration.createMany",
      });
    }
  }

  async update(entity: GoogleCalendarIntegration): Promise<void> {
    const modelProps = GoogleCalendarIntegrationModelMapper.toModel(entity);
    try {
      await this.client.googleCalendarIntegration.update({
        where: { id: entity.integration_id.id },
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.integration_id.id,
        operation: "googleCalendarIntegration.update",
      });
    }
  }

  async delete(entity_id: GoogleCalendarIntegrationId): Promise<void> {
    try {
      await this.client.googleCalendarIntegration.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "googleCalendarIntegration.delete",
      });
    }
  }

  async findById(
    entity_id: GoogleCalendarIntegrationId,
  ): Promise<GoogleCalendarIntegration | null> {
    const model = await this.client.googleCalendarIntegration.findUnique({
      where: { id: entity_id.id },
    });
    return model ? GoogleCalendarIntegrationModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<GoogleCalendarIntegration[]> {
    const models = await this.client.googleCalendarIntegration.findMany();
    return models.map((model) =>
      GoogleCalendarIntegrationModelMapper.toEntity(model),
    );
  }

  async findByIds(
    ids: GoogleCalendarIntegrationId[],
  ): Promise<GoogleCalendarIntegration[]> {
    const models = await this.client.googleCalendarIntegration.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((m) => GoogleCalendarIntegrationModelMapper.toEntity(m));
  }

  async existsById(ids: GoogleCalendarIntegrationId[]): Promise<{
    exists: GoogleCalendarIntegrationId[];
    not_exists: GoogleCalendarIntegrationId[];
  }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.client.googleCalendarIntegration.findMany(
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

  async findByMusicianId(
    musician_id: string,
  ): Promise<GoogleCalendarIntegration | null> {
    const model = await this.client.googleCalendarIntegration.findUnique({
      where: { musicianId: musician_id },
    });
    return model ? GoogleCalendarIntegrationModelMapper.toEntity(model) : null;
  }

  getEntity(): new (...args: any[]) => GoogleCalendarIntegration {
    return GoogleCalendarIntegration;
  }
}
