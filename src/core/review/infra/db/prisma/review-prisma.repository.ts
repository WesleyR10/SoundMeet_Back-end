import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  Review,
  REVIEW_AUTHOR_TYPES,
  ReviewAuthorType,
  ReviewId,
  ReviewTargetType,
} from "../../../domain/review.aggregate";
import {
  IReviewRepository,
  ReviewFilter,
  ReviewSearchParams,
  ReviewSearchResult,
} from "../../../domain/review.repository";
import { ReviewModel, ReviewModelMapper } from "./review-model.mapper";

export class ReviewPrismaRepository implements IReviewRepository {
  sortableFields: string[] = ["rating", "created_at"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Review): Promise<void> {
    try {
      await this.prisma.review.create({
        data: ReviewModelMapper.toModel(entity),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.review_id.id,
        operation: "review.create",
      });
    }
  }

  async bulkInsert(entities: Review[]): Promise<void> {
    try {
      await this.prisma.review.createMany({
        data: entities.map(ReviewModelMapper.toModel),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: "bulk",
        operation: "review.bulkInsert",
      });
    }
  }

  async update(entity: Review): Promise<void> {
    const model = ReviewModelMapper.toModel(entity);
    try {
      await this.prisma.review.update({
        where: { id: model.id },
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.review_id.id,
        operation: "review.update",
      });
    }
  }

  async delete(id: ReviewId): Promise<void> {
    try {
      await this.prisma.review.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "review.delete",
      });
    }
  }

  async findById(id: ReviewId): Promise<Review | null> {
    const model = await this.prisma.review.findUnique({
      where: { id: id.id },
    });
    return model ? ReviewModelMapper.toEntity(model as ReviewModel) : null;
  }

  async findByIds(ids: ReviewId[]): Promise<Review[]> {
    const models = await this.prisma.review.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) => ReviewModelMapper.toEntity(m as ReviewModel));
  }

  async findAll(): Promise<Review[]> {
    const models = await this.prisma.review.findMany();
    return models.map((m) => ReviewModelMapper.toEntity(m as ReviewModel));
  }

  async existsById(
    ids: ReviewId[],
  ): Promise<{ exists: ReviewId[]; not_exists: ReviewId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.prisma.review.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));

    return {
      exists: ids.filter((i) => existingIds.has(i.id)),
      not_exists: ids.filter((i) => !existingIds.has(i.id)),
    };
  }

  async findByAuthorAndContext(params: {
    target_type: ReviewTargetType;
    target_id: string;
    author_id: string;
    context_id: string;
  }): Promise<Review | null> {
    const model = await this.prisma.review.findUnique({
      where: {
        target_type_target_id_author_id_context_id: {
          target_type: params.target_type,
          target_id: params.target_id,
          author_id: params.author_id,
          context_id: params.context_id,
        },
      },
    });
    return model ? ReviewModelMapper.toEntity(model as ReviewModel) : null;
  }

  async aggregateForTarget(params: {
    target_type: ReviewTargetType;
    target_id: string;
  }): Promise<{ average: number; total: number }> {
    // Agregação NO banco: a média é recalculada sobre o ledger inteiro sem
    // trazer nenhuma linha para a aplicação — o mesmo cuidado do
    // `jsonb_array_length` no read-model de cifra pessoal (8E.3).
    const result = await this.prisma.review.aggregate({
      where: {
        target_type: params.target_type,
        target_id: params.target_id,
      },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const total = result._count._all;
    const avg = result._avg.rating ?? 0;

    return {
      average: total === 0 ? 0 : Math.round(avg * 10) / 10,
      total,
    };
  }

  async aggregateForTargetByAuthor(params: {
    target_type: ReviewTargetType;
    target_id: string;
  }): Promise<
    Partial<Record<ReviewAuthorType, { average: number; total: number }>>
  > {
    // UMA query com `groupBy`, não uma por tipo de autor: são três tipos hoje,
    // e três round-trips para responder um cabeçalho de perfil é o começo do
    // N+1 que o `jsonb_array_length` do read-model de cifra evitou.
    const rows = await this.prisma.review.groupBy({
      by: ["author_type"],
      where: {
        target_type: params.target_type,
        target_id: params.target_id,
      },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const result: Partial<
      Record<ReviewAuthorType, { average: number; total: number }>
    > = {};

    for (const row of rows) {
      const total = row._count._all;
      if (total === 0) continue;

      /*
       * ⚠️ `author_type` é String no banco (não enum), então o Postgres pode
       * devolver um valor que o domínio não conhece — linha antiga, ou um tipo
       * de autor novo escrito antes deste código existir. Descartar é o certo:
       * somá-lo a um dos buckets conhecidos atribuiria a opinião de alguém ao
       * grupo errado, e a soma dos parciais já não bate com a média geral de
       * propósito (ver `aggregateForTargetByAuthor` na interface).
       */
      if (!REVIEW_AUTHOR_TYPES.includes(row.author_type as ReviewAuthorType)) {
        continue;
      }

      result[row.author_type as ReviewAuthorType] = {
        average: Math.round((row._avg.rating ?? 0) * 10) / 10,
        total,
      };
    }

    return result;
  }

  async search(props: ReviewSearchParams): Promise<ReviewSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const where = this.buildWhereClause(props.filter);

    const [models, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: this.buildOrderByClause(props.sort, props.sort_dir),
        skip: offset,
        take: props.per_page,
      }),
      this.prisma.review.count({ where }),
    ]);

    return new ReviewSearchResult({
      items: models.map((m) => ReviewModelMapper.toEntity(m as ReviewModel)),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: ReviewFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.target_type) where.target_type = `${filter.target_type}`;
    if (filter.target_id) where.target_id = filter.target_id;
    if (filter.author_type) where.author_type = `${filter.author_type}`;
    if (filter.author_id) where.author_id = filter.author_id;
    if (filter.context_type) where.context_type = `${filter.context_type}`;
    if (filter.context_id) where.context_id = filter.context_id;

    // `false` é valor legítimo — não pode cair num truthy-check.
    if (typeof filter.has_comment === "boolean") {
      where.comment = filter.has_comment ? { not: null } : null;
    }

    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: string | null,
  ): any {
    // Perfil mostra a mais recente primeiro — default explícito, e sort
    // arbitrário é rejeitado pela allowlist (evita orderBy inválido do Prisma).
    if (!sort || !this.sortableFields.includes(sort)) {
      return { created_at: "desc" };
    }
    return { [sort]: sort_dir === "asc" ? "asc" : "desc" };
  }

  getEntity(): new (...args: any[]) => Review {
    return Review;
  }
}
