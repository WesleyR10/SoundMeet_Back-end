import { Prisma, PrismaClient } from "@prisma/client";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  AiAudioUpload,
  AiAudioUploadId,
} from "../../../domain/ai-audio-upload.aggregate";
import {
  AiAudioUploadFilter,
  AiAudioUploadSearchParams,
  AiAudioUploadSearchResult,
  IAiAudioUploadRepository,
} from "../../../domain/ai-audio-upload.repository";
import { AiAudioUploadModelMapper } from "./ai-audio-upload-model-mapper";

export class AiAudioUploadPrismaRepository implements IAiAudioUploadRepository {
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: AiAudioUpload): Promise<void> {
    const modelProps = AiAudioUploadModelMapper.toModel(entity);
    try {
      await this.prisma.aiAudioUpload.create({ data: modelProps as any });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.ai_audio_upload_id.id,
        operation: "aiAudioUpload.create",
      });
    }
  }

  async bulkInsert(entities: AiAudioUpload[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      AiAudioUploadModelMapper.toModel(entity),
    );
    try {
      await this.prisma.aiAudioUpload.createMany({ data: modelsProps as any });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "aiAudioUpload.createMany",
      });
    }
  }

  async update(entity: AiAudioUpload): Promise<void> {
    const id = entity.ai_audio_upload_id.id;
    const modelProps = AiAudioUploadModelMapper.toModel(entity);
    try {
      await this.prisma.aiAudioUpload.update({
        where: { id },
        data: modelProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "aiAudioUpload.update",
      });
    }
  }

  async delete(id: AiAudioUploadId): Promise<void> {
    try {
      await this.prisma.aiAudioUpload.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "aiAudioUpload.delete",
      });
    }
  }

  async findById(entity_id: AiAudioUploadId): Promise<AiAudioUpload | null> {
    const model = await this.prisma.aiAudioUpload.findUnique({
      where: { id: entity_id.id },
    });
    return model ? AiAudioUploadModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: AiAudioUploadId[]): Promise<AiAudioUpload[]> {
    const models = await this.prisma.aiAudioUpload.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) => AiAudioUploadModelMapper.toEntity(m as any));
  }

  async findAll(): Promise<AiAudioUpload[]> {
    const models = await this.prisma.aiAudioUpload.findMany();
    return models.map((m) => AiAudioUploadModelMapper.toEntity(m as any));
  }

  async existsById(
    ids: AiAudioUploadId[],
  ): Promise<{ exists: AiAudioUploadId[]; not_exists: AiAudioUploadId[] }> {
    const existingModels = await this.prisma.aiAudioUpload.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const existingIds = existingModels.map((m) => new AiAudioUploadId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );
    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(
    props: AiAudioUploadSearchParams,
  ): Promise<AiAudioUploadSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [items, total] = await Promise.all([
      this.prisma.aiAudioUpload.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.aiAudioUpload.count({ where }),
    ]);

    return new AiAudioUploadSearchResult({
      items: items.map((m) => AiAudioUploadModelMapper.toEntity(m as any)),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  getEntity(): new (...args: any[]) => AiAudioUpload {
    return AiAudioUpload;
  }

  private buildWhereClause(
    filter: AiAudioUploadFilter | null,
  ): Prisma.AiAudioUploadWhereInput {
    if (!filter) return {};
    return {
      ...(filter.musician_id ? { musicianId: filter.musician_id } : {}),
      ...(filter.status ? { status: filter.status } : {}),
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
