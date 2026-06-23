import { Prisma, PrismaClient } from "@prisma/client";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  AiCifraUpload,
  AiCifraUploadId,
} from "../../../domain/ai-cifra-upload.aggregate";
import {
  AiCifraUploadFilter,
  AiCifraUploadSearchParams,
  AiCifraUploadSearchResult,
  IAiCifraUploadRepository,
} from "../../../domain/ai-cifra-upload.repository";
import { AiCifraUploadModelMapper } from "./ai-cifra-upload-model-mapper";

export class AiCifraUploadPrismaRepository implements IAiCifraUploadRepository {
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: AiCifraUpload): Promise<void> {
    const modelProps = AiCifraUploadModelMapper.toModel(entity);
    try {
      await this.prisma.aiCifraUpload.create({ data: modelProps as any });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.ai_cifra_upload_id.id,
        operation: "aiCifraUpload.create",
      });
    }
  }

  async bulkInsert(entities: AiCifraUpload[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      AiCifraUploadModelMapper.toModel(entity),
    );
    try {
      await this.prisma.aiCifraUpload.createMany({ data: modelsProps as any });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "aiCifraUpload.createMany",
      });
    }
  }

  async update(entity: AiCifraUpload): Promise<void> {
    const id = entity.ai_cifra_upload_id.id;
    const modelProps = AiCifraUploadModelMapper.toModel(entity);
    try {
      await this.prisma.aiCifraUpload.update({
        where: { id },
        data: modelProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "aiCifraUpload.update",
      });
    }
  }

  async delete(id: AiCifraUploadId): Promise<void> {
    try {
      await this.prisma.aiCifraUpload.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "aiCifraUpload.delete",
      });
    }
  }

  async findById(entity_id: AiCifraUploadId): Promise<AiCifraUpload | null> {
    const model = await this.prisma.aiCifraUpload.findUnique({
      where: { id: entity_id.id },
    });
    return model ? AiCifraUploadModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: AiCifraUploadId[]): Promise<AiCifraUpload[]> {
    const models = await this.prisma.aiCifraUpload.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) => AiCifraUploadModelMapper.toEntity(m as any));
  }

  async findAll(): Promise<AiCifraUpload[]> {
    const models = await this.prisma.aiCifraUpload.findMany();
    return models.map((m) => AiCifraUploadModelMapper.toEntity(m as any));
  }

  async existsById(
    ids: AiCifraUploadId[],
  ): Promise<{ exists: AiCifraUploadId[]; not_exists: AiCifraUploadId[] }> {
    const existingModels = await this.prisma.aiCifraUpload.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const existingIds = existingModels.map((m) => new AiCifraUploadId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );
    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(
    props: AiCifraUploadSearchParams,
  ): Promise<AiCifraUploadSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [items, total] = await Promise.all([
      this.prisma.aiCifraUpload.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.aiCifraUpload.count({ where }),
    ]);

    return new AiCifraUploadSearchResult({
      items: items.map((m) => AiCifraUploadModelMapper.toEntity(m as any)),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  getEntity(): new (...args: any[]) => AiCifraUpload {
    return AiCifraUpload;
  }

  private buildWhereClause(
    filter: AiCifraUploadFilter | null,
  ): Prisma.AiCifraUploadWhereInput {
    if (!filter) return {};
    return {
      ...(filter.musician_id ? { musicianId: filter.musician_id } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.updated_at_lte
        ? { updated_at: { lte: filter.updated_at_lte } }
        : {}),
    };
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    if (!sort || !this.sortableFields.includes(sort)) return undefined;
    const direction = sort_dir ?? "desc";
    return [{ [sort]: direction }];
  }
}
