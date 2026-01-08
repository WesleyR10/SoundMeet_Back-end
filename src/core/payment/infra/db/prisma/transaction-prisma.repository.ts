import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
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

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Transaction): Promise<void> {
    const modelProps = TransactionModelMapper.toModel(entity);
    await this.prisma.transaction.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: Transaction[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      TransactionModelMapper.toModel(entity),
    );
    await this.prisma.transaction.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Transaction): Promise<void> {
    const modelProps = TransactionModelMapper.toModel(entity);
    try {
      await this.prisma.transaction.update({
        where: { id: entity.transaction_id.id },
        data: modelProps,
      });
    } catch (e) {
      throw new NotFoundError(entity.transaction_id.id, Transaction);
    }
  }

  async delete(entity_id: Uuid): Promise<void> {
    try {
      await this.prisma.transaction.delete({
        where: { id: entity_id.id },
      });
    } catch (e) {
      throw new NotFoundError(entity_id.id, Transaction);
    }
  }

  async findById(entity_id: Uuid): Promise<Transaction | null> {
    const model = await this.prisma.transaction.findUnique({
      where: { id: entity_id.id },
    });

    return model ? TransactionModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<Transaction[]> {
    const models = await this.prisma.transaction.findMany();
    return models.map((model) => TransactionModelMapper.toEntity(model));
  }

  async findByIds(ids: Uuid[]): Promise<Transaction[]> {
    const models = await this.prisma.transaction.findMany({
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

    const existingModels = await this.prisma.transaction.findMany({
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
      this.prisma.transaction.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
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
    const models = await this.prisma.transaction.findMany({
      where: { musicianId },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => TransactionModelMapper.toEntity(model));
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    const models = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => TransactionModelMapper.toEntity(model));
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
