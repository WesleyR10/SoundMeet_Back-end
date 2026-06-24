import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  ITransactionRepository,
  TransactionFilter,
  TransactionSearchParams,
  TransactionSearchResult,
} from "../../../domain/repositories/transaction.repository";
import { Transaction } from "../../../domain/transaction.aggregate";
import { TransactionModelMapper } from "./transaction-model.mapper";

export class TransactionPrismaRepository implements ITransactionRepository {
  sortableFields: string[] = ["created_at", "amount", "status", "type"];

  constructor(
    private prisma: PrismaClient,
    private readonly uow?: IUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private get client(): PrismaClient | Prisma.TransactionClient {
    return this.uow?.getTransaction() ?? this.prisma;
  }

  async insert(entity: Transaction): Promise<void> {
    const modelProps = TransactionModelMapper.toModel(entity);
    try {
      await this.client.transaction.create({
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.transaction_id.id,
        operation: "transaction.create",
      });
    }
  }

  async bulkInsert(entities: Transaction[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      TransactionModelMapper.toModel(entity),
    );
    try {
      await this.client.transaction.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "transaction.createMany",
      });
    }
  }

  async update(entity: Transaction): Promise<void> {
    const modelProps = TransactionModelMapper.toModel(entity);
    try {
      await this.client.transaction.update({
        where: { id: entity.transaction_id.id },
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.transaction_id.id,
        operation: "transaction.update",
      });
    }
  }

  async delete(entity_id: Uuid): Promise<void> {
    try {
      await this.client.transaction.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "transaction.delete",
      });
    }
  }

  async findById(entity_id: Uuid): Promise<Transaction | null> {
    const model = await this.client.transaction.findUnique({
      where: { id: entity_id.id },
    });

    return model ? TransactionModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<Transaction[]> {
    const models = await this.client.transaction.findMany();
    return models.map((model) => TransactionModelMapper.toEntity(model));
  }

  async findByIds(ids: Uuid[]): Promise<Transaction[]> {
    const models = await this.client.transaction.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => TransactionModelMapper.toEntity(m));
  }

  async existsById(
    ids: Uuid[],
  ): Promise<{ exists: Uuid[]; not_exists: Uuid[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.client.transaction.findMany({
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

  async search(
    props: TransactionSearchParams,
  ): Promise<TransactionSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { where, orderBy } = this.buildSearchQuery(props);

    const [models, count] = await Promise.all([
      this.client.transaction.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.client.transaction.count({ where }),
    ]);

    const entities = models.map((model) =>
      TransactionModelMapper.toEntity(model),
    );

    return new TransactionSearchResult({
      items: entities,
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  // Métodos específicos do domínio
  async findByMusicianId(musicianId: string): Promise<Transaction[]> {
    const models = await this.client.transaction.findMany({
      where: { musicianId },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => TransactionModelMapper.toEntity(model));
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    const models = await this.client.transaction.findMany({
      where: { userId },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => TransactionModelMapper.toEntity(model));
  }

  async findByExternalId(externalId: string): Promise<Transaction | null> {
    const model = await this.client.transaction.findFirst({
      where: { externalId },
    });
    return model ? TransactionModelMapper.toEntity(model) : null;
  }

  getEntity(): new (...args: any[]) => Transaction {
    return Transaction;
  }

  private buildSearchQuery(props: TransactionSearchParams) {
    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);
    return { where, orderBy };
  }

  private buildWhereClause(filter: TransactionFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }

    if (filter.user_id) {
      where.userId = filter.user_id;
    }

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.start_date && filter.end_date) {
      where.created_at = {
        gte: filter.start_date,
        lte: filter.end_date,
      };
    } else if (filter.start_date) {
      where.created_at = {
        gte: filter.start_date,
      };
    } else if (filter.end_date) {
      where.created_at = {
        lte: filter.end_date,
      };
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
