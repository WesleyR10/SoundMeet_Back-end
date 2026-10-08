import { Prisma, PrismaClient } from "@prisma/client";

import { IEncryptionService } from "../../../../shared/domain/encryption.service";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  ITipRepository,
  TipFilter,
  TipSearchParams,
  TipSearchResult,
} from "../../../domain/repositories/tip.repository";
import { Tip, TipId } from "../../../domain/tip.aggregate";
import { TipStatus } from "../../../domain/tip-enums";
import { TipModelMapper } from "./tip-model.mapper";

export class TipPrismaRepository implements ITipRepository {
  sortableFields: string[] = ["created_at", "amount", "status"];
  private readonly mapper: TipModelMapper;

  constructor(
    private prisma: PrismaClient,
    private readonly uow: IUnitOfWork<Prisma.TransactionClient> | undefined,
    encryption: IEncryptionService,
  ) {
    this.mapper = new TipModelMapper(encryption);
  }

  private get client(): PrismaClient | Prisma.TransactionClient {
    return this.uow?.getTransaction() ?? this.prisma;
  }

  async insert(entity: Tip): Promise<void> {
    const modelProps = this.mapper.toModel(entity);
    try {
      await this.client.tip.create({
        data: {
          ...modelProps,
          musicianId: modelProps.musicianId ?? null,
          bandId: modelProps.bandId ?? null,
          eventId: modelProps.eventId ?? null,
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.tip_id.id,
        operation: "tip.create",
      });
    }
  }

  async bulkInsert(entities: Tip[]): Promise<void> {
    const modelsProps = entities.map((entity) => {
      const model = this.mapper.toModel(entity);
      return {
        ...model,
        musicianId: model.musicianId ?? null,
        bandId: model.bandId ?? null,
        eventId: model.eventId ?? null,
      };
    });
    try {
      await this.client.tip.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "tip.createMany",
      });
    }
  }

  async update(entity: Tip): Promise<void> {
    const modelProps = this.mapper.toModel(entity);
    try {
      await this.client.tip.update({
        where: { id: entity.tip_id.id },
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.tip_id.id,
        operation: "tip.update",
      });
    }
  }

  async delete(entity_id: TipId): Promise<void> {
    try {
      await this.client.tip.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "tip.delete",
      });
    }
  }

  async findById(entity_id: TipId | string): Promise<Tip | null> {
    const id = entity_id instanceof TipId ? entity_id.id : entity_id;
    const model = await this.client.tip.findUnique({
      where: { id },
    });

    return model ? this.mapper.toEntity(model) : null;
  }

  async findAll(): Promise<Tip[]> {
    const models = await this.client.tip.findMany();
    return models.map((model) => this.mapper.toEntity(model));
  }

  async findByIds(ids: TipId[]): Promise<Tip[]> {
    const models = await this.client.tip.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => this.mapper.toEntity(m));
  }

  async existsById(
    ids: TipId[],
  ): Promise<{ exists: TipId[]; not_exists: TipId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.client.tip.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => m.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));

    return {
      exists,
      not_exists,
    };
  }

  async search(props: TipSearchParams): Promise<TipSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { where, orderBy } = this.buildSearchQuery(props);

    const [models, count] = await Promise.all([
      this.client.tip.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.client.tip.count({ where }),
    ]);

    const entities = models.map((model) => this.mapper.toEntity(model));

    return new TipSearchResult({
      items: entities,
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  // Métodos específicos do domínio
  async findByMusicianId(musicianId: string): Promise<Tip[]> {
    const models = await this.client.tip.findMany({
      where: { musicianId },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => this.mapper.toEntity(model));
  }

  async findCompletedByEvents(event_ids: string[]): Promise<Tip[]> {
    if (event_ids.length === 0) return [];
    const models = await this.client.tip.findMany({
      where: { eventId: { in: event_ids }, status: TipStatus.COMPLETED },
    });
    return models.map((model) => this.mapper.toEntity(model));
  }

  async sumCompletedByMusician(musician_id: string): Promise<number> {
    const result = await this.client.tip.aggregate({
      where: { musicianId: musician_id, status: TipStatus.COMPLETED },
      _sum: { amount: true },
    });
    // `Decimal(12,2)` chega exato; o arredondamento só apara a conversão.
    return Math.round(Number(result._sum.amount ?? 0) * 100) / 100;
  }

  getEntity(): new (...args: any[]) => Tip {
    return Tip;
  }

  private buildSearchQuery(props: TipSearchParams) {
    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);
    return { where, orderBy };
  }

  private buildWhereClause(filter: TipFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }

    if (filter.audience_id) {
      where.audienceId = filter.audience_id;
    }

    if (filter.event_id) {
      where.eventId = filter.event_id;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: "asc" | "desc" | null,
  ) {
    if (sort && this.sortableFields.includes(sort)) {
      return { [sort]: sort_dir || "asc" };
    }
    return { created_at: sort_dir || "asc" };
  }
}
