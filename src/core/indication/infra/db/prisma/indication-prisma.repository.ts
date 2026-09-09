import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Indication, IndicationId } from "../../../domain/indication.aggregate";
import {
  IIndicationRepository,
  IndicationFilter,
  IndicationSearchParams,
  IndicationSearchResult,
} from "../../../domain/indication.repository";
import {
  IndicationModel,
  IndicationModelMapper,
} from "./indication-model.mapper";

export class IndicationPrismaRepository implements IIndicationRepository {
  sortableFields: string[] = ["created_at", "status"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Indication): Promise<void> {
    try {
      await this.prisma.indication.create({
        data: IndicationModelMapper.toModel(entity),
      });
    } catch (error: any) {
      // A unique (audience, musician, establishment) vira ConflictError aqui —
      // é a defesa real contra dois POSTs simultâneos do mesmo fã.
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.indication_id.id,
        operation: "indication.create",
      });
    }
  }

  async bulkInsert(entities: Indication[]): Promise<void> {
    try {
      await this.prisma.indication.createMany({
        data: entities.map(IndicationModelMapper.toModel),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: "bulk",
        operation: "indication.bulkInsert",
      });
    }
  }

  async update(entity: Indication): Promise<void> {
    const model = IndicationModelMapper.toModel(entity);
    try {
      await this.prisma.indication.update({
        where: { id: model.id },
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.indication_id.id,
        operation: "indication.update",
      });
    }
  }

  async delete(id: IndicationId): Promise<void> {
    try {
      await this.prisma.indication.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "indication.delete",
      });
    }
  }

  async findById(id: IndicationId): Promise<Indication | null> {
    const model = await this.prisma.indication.findUnique({
      where: { id: id.id },
    });
    return model
      ? IndicationModelMapper.toEntity(model as IndicationModel)
      : null;
  }

  async findByIds(ids: IndicationId[]): Promise<Indication[]> {
    const models = await this.prisma.indication.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) =>
      IndicationModelMapper.toEntity(m as IndicationModel),
    );
  }

  async findAll(): Promise<Indication[]> {
    const models = await this.prisma.indication.findMany();
    return models.map((m) =>
      IndicationModelMapper.toEntity(m as IndicationModel),
    );
  }

  async existsById(
    ids: IndicationId[],
  ): Promise<{ exists: IndicationId[]; not_exists: IndicationId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.prisma.indication.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));

    return {
      exists: ids.filter((i) => existingIds.has(i.id)),
      not_exists: ids.filter((i) => !existingIds.has(i.id)),
    };
  }

  async findByTrio(params: {
    audience_id: string;
    musician_id: string;
    establishment_id: string;
  }): Promise<Indication | null> {
    const model = await this.prisma.indication.findUnique({
      where: {
        audience_id_musician_id_establishment_id: {
          audience_id: params.audience_id,
          musician_id: params.musician_id,
          establishment_id: params.establishment_id,
        },
      },
    });
    return model
      ? IndicationModelMapper.toEntity(model as IndicationModel)
      : null;
  }

  async countNewByEstablishment(establishment_id: string): Promise<number> {
    // Contagem NO banco, servida pelo índice
    // (establishment_id, status, created_at) — o badge da caixa de entrada é
    // lido em toda visita ao dashboard.
    return this.prisma.indication.count({
      where: { establishment_id, status: "new" },
    });
  }

  async search(props: IndicationSearchParams): Promise<IndicationSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const where = this.buildWhereClause(props.filter);

    const [models, total] = await Promise.all([
      this.prisma.indication.findMany({
        where,
        orderBy: this.buildOrderByClause(props.sort, props.sort_dir),
        skip: offset,
        take: props.per_page,
      }),
      this.prisma.indication.count({ where }),
    ]);

    return new IndicationSearchResult({
      items: models.map((m) =>
        IndicationModelMapper.toEntity(m as IndicationModel),
      ),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: IndicationFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.audience_id) where.audience_id = filter.audience_id;
    if (filter.musician_id) where.musician_id = filter.musician_id;
    if (filter.establishment_id)
      where.establishment_id = filter.establishment_id;
    if (filter.status) where.status = `${filter.status}`;

    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: string | null,
  ): any {
    // Caixa de entrada: a mais recente primeiro. Sort fora da allowlist é
    // ignorado — orderBy inválido derrubaria a consulta no Prisma.
    if (!sort || !this.sortableFields.includes(sort)) {
      return { created_at: "desc" };
    }
    return { [sort]: sort_dir === "asc" ? "asc" : "desc" };
  }

  getEntity(): new (...args: any[]) => Indication {
    return Indication;
  }
}
