import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import {
  EstablishmentFilter,
  EstablishmentSearchParams,
  EstablishmentSearchResult,
  IEstablishmentRepository,
} from "../../../domain/establishment.repository";
import { EstablishmentModelMapper } from "./establishment-model-mapper";

export class EstablishmentPrismaRepository implements IEstablishmentRepository {
  sortableFields: string[] = ["name", "created_at", "rating"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Establishment): Promise<void> {
    const modelProps = EstablishmentModelMapper.toModel(entity);
    await this.prisma.establishment.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: Establishment[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      EstablishmentModelMapper.toModel(entity),
    );
    await this.prisma.establishment.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Establishment): Promise<void> {
    const id = entity.establishment_id.id;
    const modelProps = EstablishmentModelMapper.toModel(entity);

    try {
      await this.prisma.establishment.update({
        where: { id: id },
        data: modelProps,
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id, this.getEntity());
      }
      throw error;
    }
  }

  async delete(establishment_id: EstablishmentId): Promise<void> {
    const id = establishment_id.id;

    try {
      await this.prisma.establishment.delete({
        where: { id: id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(establishment_id.id, this.getEntity());
      }
      throw error;
    }
  }

  async findById(entity_id: EstablishmentId): Promise<Establishment | null> {
    const model = await this.prisma.establishment.findUnique({
      where: { id: entity_id.id },
    });

    return model ? EstablishmentModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: EstablishmentId[]): Promise<Establishment[]> {
    const models = await this.prisma.establishment.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });

    return models.map((model) => EstablishmentModelMapper.toEntity(model));
  }

  async findAll(): Promise<Establishment[]> {
    const models = await this.prisma.establishment.findMany();
    return models.map((model) => EstablishmentModelMapper.toEntity(model));
  }

  async existsById(
    ids: EstablishmentId[],
  ): Promise<{ exists: EstablishmentId[]; not_exists: EstablishmentId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existsEstablishmentModels = await this.prisma.establishment.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: {
        id: true,
      },
    });

    const existsEstablishmentIds = existsEstablishmentModels.map(
      (m) => new EstablishmentId(m.id),
    );
    const notExistsEstablishmentIds = ids.filter(
      (id) => !existsEstablishmentIds.some((e) => e.equals(id)),
    );
    return {
      exists: existsEstablishmentIds,
      not_exists: notExistsEstablishmentIds,
    };
  }

  async search(
    props: EstablishmentSearchParams,
  ): Promise<EstablishmentSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.prisma.establishment.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.establishment.count({ where }),
    ]);

    const items = models.map((model) =>
      EstablishmentModelMapper.toEntity(model),
    );

    return new EstablishmentSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: EstablishmentFilter | null) {
    if (!filter) return {};

    const orConditions: any[] = [];
    const andConditions: any = {};

    if (filter.name) {
      orConditions.push({
        name: {
          contains: filter.name,
          mode: "insensitive",
        },
      });
    }

    if (filter.email) {
      orConditions.push({
        email: {
          contains: filter.email,
          mode: "insensitive",
        },
      });
    }

    if (filter.cnpj) {
      orConditions.push({
        cnpj: {
          contains: filter.cnpj,
        },
      });
    }

    if (typeof filter.is_active === "boolean") {
      andConditions.is_active = filter.is_active;
    }

    if (typeof filter.is_verified === "boolean") {
      andConditions.is_verified = filter.is_verified;
    }

    const where: any = {};

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    if (Object.keys(andConditions).length > 0) {
      Object.assign(where, andConditions);
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

    // Para o campo rating, precisamos mapear para o campo correto no Prisma
    const sortField = sort === "rating" ? "rating" : sort;

    return {
      [sortField]: sort_dir === "asc" ? ("asc" as const) : ("desc" as const),
    };
  }

  getEntity(): new (...args: any[]) => Establishment {
    return Establishment;
  }
}
