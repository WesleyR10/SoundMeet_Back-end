import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Follow, FollowId } from "../../../domain/follow.aggregate";
import {
  FollowFilter,
  FollowSearchParams,
  FollowSearchResult,
  IFollowRepository,
} from "../../../domain/follow.repository";
import { FollowTarget } from "../../../domain/follow-types";
import { FollowModel, FollowModelMapper } from "./follow-model.mapper";

export class FollowPrismaRepository implements IFollowRepository {
  sortableFields: string[] = ["created_at"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Follow): Promise<void> {
    try {
      await this.prisma.follow.create({
        data: FollowModelMapper.toModel(entity),
      });
    } catch (error: any) {
      // A unique (fã, tipo, alvo) vira ConflictError — o use-case trata.
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.follow_id.id,
        operation: "follow.create",
      });
    }
  }

  async bulkInsert(entities: Follow[]): Promise<void> {
    try {
      await this.prisma.follow.createMany({
        data: entities.map(FollowModelMapper.toModel),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: "bulk",
        operation: "follow.bulkInsert",
      });
    }
  }

  async update(entity: Follow): Promise<void> {
    const model = FollowModelMapper.toModel(entity);
    try {
      await this.prisma.follow.update({ where: { id: model.id }, data: model });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.follow_id.id,
        operation: "follow.update",
      });
    }
  }

  async delete(id: FollowId): Promise<void> {
    try {
      await this.prisma.follow.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "follow.delete",
      });
    }
  }

  async findById(id: FollowId): Promise<Follow | null> {
    const model = await this.prisma.follow.findUnique({ where: { id: id.id } });
    return model ? FollowModelMapper.toEntity(model as FollowModel) : null;
  }

  async findByIds(ids: FollowId[]): Promise<Follow[]> {
    const models = await this.prisma.follow.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) => FollowModelMapper.toEntity(m as FollowModel));
  }

  async findAll(): Promise<Follow[]> {
    const models = await this.prisma.follow.findMany();
    return models.map((m) => FollowModelMapper.toEntity(m as FollowModel));
  }

  async existsById(
    ids: FollowId[],
  ): Promise<{ exists: FollowId[]; not_exists: FollowId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }
    const existing = await this.prisma.follow.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));
    return {
      exists: ids.filter((i) => existingIds.has(i.id)),
      not_exists: ids.filter((i) => !existingIds.has(i.id)),
    };
  }

  async findByAudienceAndTarget(
    params: { audience_id: string } & FollowTarget,
  ): Promise<Follow | null> {
    const model = await this.prisma.follow.findUnique({
      where: {
        audience_id_target_type_target_id: {
          audience_id: params.audience_id,
          target_type: params.target_type,
          target_id: params.target_id,
        },
      },
    });
    return model ? FollowModelMapper.toEntity(model as FollowModel) : null;
  }

  async countByTarget(target: FollowTarget): Promise<number> {
    return this.prisma.follow.count({
      where: { target_type: target.target_type, target_id: target.target_id },
    });
  }

  async listNotifiableFollowerIds(params: {
    targets: FollowTarget[];
    after: string | null;
    limit: number;
  }): Promise<string[]> {
    // 🔴 Sem alvo, nenhum destinatário — um `OR: []` viraria "todos".
    if (!params.targets.length) return [];

    // SQL explícito, não `findMany({ distinct })`: sem `nativeDistinct` o
    // Prisma deduplica EM MEMÓRIA, buscando todas as linhas que casam — e um
    // músico com 20 mil seguidores traria 20 mil linhas por lote.
    const matchesTarget = Prisma.join(
      params.targets.map(
        (t) =>
          Prisma.sql`("target_type" = ${t.target_type} AND "target_id" = ${t.target_id})`,
      ),
      " OR ",
    );
    const afterClause = params.after
      ? Prisma.sql`AND "audience_id" > ${params.after}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<{ audience_id: string }>>`
      SELECT DISTINCT "audience_id"
      FROM "follows"
      WHERE "notifications_enabled" = true
        AND (${matchesTarget})
        ${afterClause}
      ORDER BY "audience_id" ASC
      LIMIT ${params.limit}
    `;
    return rows.map((r) => r.audience_id);
  }

  async search(props: FollowSearchParams): Promise<FollowSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const where = this.buildWhereClause(props.filter);

    const [models, total] = await Promise.all([
      this.prisma.follow.findMany({
        where,
        orderBy: { created_at: props.sort_dir === "asc" ? "asc" : "desc" },
        skip: offset,
        take: props.per_page,
      }),
      this.prisma.follow.count({ where }),
    ]);

    return new FollowSearchResult({
      items: models.map((m) => FollowModelMapper.toEntity(m as FollowModel)),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(
    filter?: FollowFilter | null,
  ): Prisma.FollowWhereInput {
    if (!filter) return {};
    const where: Prisma.FollowWhereInput = {};
    if (filter.audience_id) where.audience_id = filter.audience_id;
    if (filter.target_type) where.target_type = `${filter.target_type}`;
    if (filter.target_id) where.target_id = filter.target_id;
    return where;
  }

  getEntity(): new (...args: any[]) => Follow {
    return Follow;
  }
}
