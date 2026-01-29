import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Inquiry, InquiryId } from "../../../domain/inquiry.aggregate";
import {
  IInquiryRepository,
  InquiryFilter,
  InquirySearchParams,
  InquirySearchResult,
} from "../../../domain/inquiry.repository";
import { InquiryModelMapper } from "./inquiry-model-mapper";

export class InquiryPrismaRepository implements IInquiryRepository {
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Inquiry): Promise<void> {
    const modelProps = InquiryModelMapper.toModel(entity);
    try {
      await this.prisma.inquiry.create({
        data: modelProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.inquiry_id.id,
        operation: "inquiry.create",
      });
    }
  }

  async bulkInsert(entities: Inquiry[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      InquiryModelMapper.toModel(entity),
    );
    try {
      await this.prisma.inquiry.createMany({
        data: modelsProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "inquiry.createMany",
      });
    }
  }

  async update(entity: Inquiry): Promise<void> {
    const id = entity.inquiry_id.id;
    const modelProps = InquiryModelMapper.toModel(entity);

    try {
      await this.prisma.inquiry.update({
        where: { id },
        data: modelProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "inquiry.update",
      });
    }
  }

  async delete(entity_id: InquiryId): Promise<void> {
    const id = entity_id.id;
    try {
      await this.prisma.inquiry.delete({
        where: { id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "inquiry.delete",
      });
    }
  }

  async findById(entity_id: InquiryId): Promise<Inquiry | null> {
    const model = await this.prisma.inquiry.findUnique({
      where: { id: entity_id.id },
    });
    return model ? InquiryModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: InquiryId[]): Promise<Inquiry[]> {
    const models = await this.prisma.inquiry.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => InquiryModelMapper.toEntity(m as any));
  }

  async findAll(): Promise<Inquiry[]> {
    const models = await this.prisma.inquiry.findMany();
    return models.map((m) => InquiryModelMapper.toEntity(m as any));
  }

  async existsById(
    ids: InquiryId[],
  ): Promise<{ exists: InquiryId[]; not_exists: InquiryId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.inquiry.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => new InquiryId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(props: InquirySearchParams): Promise<InquirySearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, total] = await Promise.all([
      this.prisma.inquiry.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.inquiry.count({ where }),
    ]);

    const items = models.map((m) => InquiryModelMapper.toEntity(m as any));

    return new InquirySearchResult({
      items,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findOpenExpired(now: Date): Promise<Inquiry[]> {
    const models = await this.prisma.inquiry.findMany({
      where: {
        status: "open",
        expires_at: {
          not: null,
          lte: now,
        },
      },
    });
    return models.map((m) => InquiryModelMapper.toEntity(m as any));
  }

  private buildWhereClause(filter?: InquiryFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.establishment_id)
      where.establishmentId = filter.establishment_id;
    if (filter.musician_id) where.musicianId = filter.musician_id;
    if (filter.band_id) where.bandId = filter.band_id;
    if (filter.event_id) where.eventId = filter.event_id;
    if (filter.status) where.status = `${filter.status}`;

    if (filter.created_at_gte || filter.created_at_lte) {
      where.created_at = {
        ...(filter.created_at_gte && { gte: filter.created_at_gte }),
        ...(filter.created_at_lte && { lte: filter.created_at_lte }),
      };
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

    return {
      [sort]: sort_dir === "asc" ? ("asc" as const) : ("desc" as const),
    };
  }

  getEntity(): new (...args: any[]) => Inquiry {
    return Inquiry;
  }
}
