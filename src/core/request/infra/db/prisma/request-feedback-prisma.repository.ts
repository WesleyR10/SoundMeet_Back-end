import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  RequestFeedback,
  RequestFeedbackId,
} from "../../../domain/request-feedback.aggregate";
import {
  IRequestFeedbackRepository,
  RequestFeedbackFilter,
  RequestFeedbackSearchParams,
  RequestFeedbackSearchResult,
} from "../../../domain/request-feedback.repository";
import { RequestFeedbackModelMapper } from "./request-feedback-model.mapper";

export class RequestFeedbackPrismaRepository implements IRequestFeedbackRepository {
  sortableFields: string[] = ["created_at", "rating"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: RequestFeedback): Promise<void> {
    const modelProps = RequestFeedbackModelMapper.toModel(entity);
    try {
      await this.prisma.requestFeedback.create({
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.request_feedback_id.id,
        operation: "requestFeedback.create",
      });
    }
  }

  async bulkInsert(entities: RequestFeedback[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      RequestFeedbackModelMapper.toModel(entity),
    );
    try {
      await this.prisma.requestFeedback.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "requestFeedback.createMany",
      });
    }
  }

  async update(entity: RequestFeedback): Promise<void> {
    const id = entity.request_feedback_id.id;
    const modelProps = RequestFeedbackModelMapper.toModel(entity);

    try {
      await this.prisma.requestFeedback.update({
        where: { id },
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "requestFeedback.update",
      });
    }
  }

  async delete(id: RequestFeedbackId): Promise<void> {
    const feedbackId = id.id;

    try {
      await this.prisma.requestFeedback.delete({
        where: { id: feedbackId },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: feedbackId,
        operation: "requestFeedback.delete",
      });
    }
  }

  async findById(
    entity_id: RequestFeedbackId,
  ): Promise<RequestFeedback | null> {
    const model = await this.prisma.requestFeedback.findUnique({
      where: { id: entity_id.id },
    });

    return model ? RequestFeedbackModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: RequestFeedbackId[]): Promise<RequestFeedback[]> {
    const models = await this.prisma.requestFeedback.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => RequestFeedbackModelMapper.toEntity(m));
  }

  async findAll(): Promise<RequestFeedback[]> {
    const models = await this.prisma.requestFeedback.findMany();
    return models.map((model) => RequestFeedbackModelMapper.toEntity(model));
  }

  async findByRequestId(request_id: string): Promise<RequestFeedback | null> {
    const model = await this.prisma.requestFeedback.findUnique({
      where: { requestId: request_id },
    });

    return model ? RequestFeedbackModelMapper.toEntity(model) : null;
  }

  async existsById(ids: RequestFeedbackId[]): Promise<{
    exists: RequestFeedbackId[];
    not_exists: RequestFeedbackId[];
  }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.requestFeedback.findMany({
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
    props: RequestFeedbackSearchParams,
  ): Promise<RequestFeedbackSearchResult> {
    const where = this.buildWhereClause(props.filter);

    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.prisma.requestFeedback.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.requestFeedback.count({ where }),
    ]);

    const items = models.map((model) =>
      RequestFeedbackModelMapper.toEntity(model),
    );

    return new RequestFeedbackSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: RequestFeedbackFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.request_id) {
      where.requestId = filter.request_id;
    }

    if (filter.rating !== null && filter.rating !== undefined) {
      where.rating = filter.rating;
    }

    if (filter.min_rating !== null && filter.min_rating !== undefined) {
      where.rating = {
        ...where.rating,
        gte: filter.min_rating,
      };
    }

    if (filter.max_rating !== null && filter.max_rating !== undefined) {
      where.rating = {
        ...where.rating,
        lte: filter.max_rating,
      };
    }

    if (filter.created_after) {
      where.created_at = {
        ...where.created_at,
        gte: filter.created_after,
      };
    }

    if (filter.created_before) {
      where.created_at = {
        ...where.created_at,
        lte: filter.created_before,
      };
    }

    return where;
  }

  private buildOrderByClause(sort?: string | null, sort_dir?: string | null) {
    if (!sort || !this.sortableFields.includes(sort)) {
      return { created_at: "desc" as const };
    }

    return {
      [sort]: sort_dir === "asc" ? ("asc" as const) : ("desc" as const),
    };
  }

  getEntity(): new (...args: any[]) => RequestFeedback {
    return RequestFeedback;
  }
}
