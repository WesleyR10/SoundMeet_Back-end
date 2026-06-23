import { Prisma, PrismaClient } from "@prisma/client";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import {
  AiAudioSeparationJobFilter,
  AiAudioSeparationJobSearchParams,
  AiAudioSeparationJobSearchResult,
  IAiAudioSeparationJobRepository,
} from "../../../domain/ai-audio-separation-job.repository";
import { AiAudioSeparationJobModelMapper } from "./ai-audio-separation-job-model-mapper";

export class AiAudioSeparationJobPrismaRepository implements IAiAudioSeparationJobRepository {
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: AiAudioSeparationJob): Promise<void> {
    const modelProps = AiAudioSeparationJobModelMapper.toModel(entity);
    try {
      await this.prisma.aiAudioSeparationJob.create({
        data: modelProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.ai_audio_separation_job_id.id,
        operation: "aiAudioSeparationJob.create",
      });
    }
  }

  async bulkInsert(entities: AiAudioSeparationJob[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      AiAudioSeparationJobModelMapper.toModel(entity),
    );
    try {
      await this.prisma.aiAudioSeparationJob.createMany({
        data: modelsProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "aiAudioSeparationJob.createMany",
      });
    }
  }

  async update(entity: AiAudioSeparationJob): Promise<void> {
    const id = entity.ai_audio_separation_job_id.id;
    const modelProps = AiAudioSeparationJobModelMapper.toModel(entity);
    const outputs = entity.outputs.map((o) => ({
      id: o.ai_audio_separation_output_id.id,
      jobId: id,
      stem_name: o.stem_name,
      object_key: o.object_key,
      content_type: o.content_type,
      file_size: o.file_size,
      created_at: o.created_at,
    }));

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.aiAudioSeparationJob.update({
          where: { id },
          data: modelProps as any,
        });

        await tx.aiAudioSeparationOutput.deleteMany({ where: { jobId: id } });

        if (outputs.length) {
          await tx.aiAudioSeparationOutput.createMany({ data: outputs as any });
        }
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "aiAudioSeparationJob.update",
      });
    }
  }

  async delete(id: AiAudioSeparationJobId): Promise<void> {
    try {
      await this.prisma.aiAudioSeparationJob.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "aiAudioSeparationJob.delete",
      });
    }
  }

  async findById(
    entity_id: AiAudioSeparationJobId,
  ): Promise<AiAudioSeparationJob | null> {
    const model = await this.prisma.aiAudioSeparationJob.findUnique({
      where: { id: entity_id.id },
      include: { outputs: true },
    });
    return model
      ? AiAudioSeparationJobModelMapper.toEntity(model as any)
      : null;
  }

  async findByIds(
    ids: AiAudioSeparationJobId[],
  ): Promise<AiAudioSeparationJob[]> {
    const models = await this.prisma.aiAudioSeparationJob.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      include: { outputs: true },
    });
    return models.map((m) =>
      AiAudioSeparationJobModelMapper.toEntity(m as any),
    );
  }

  async findAll(): Promise<AiAudioSeparationJob[]> {
    const models = await this.prisma.aiAudioSeparationJob.findMany({
      include: { outputs: true },
    });
    return models.map((m) =>
      AiAudioSeparationJobModelMapper.toEntity(m as any),
    );
  }

  async existsById(ids: AiAudioSeparationJobId[]): Promise<{
    exists: AiAudioSeparationJobId[];
    not_exists: AiAudioSeparationJobId[];
  }> {
    const existingModels = await this.prisma.aiAudioSeparationJob.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const existingIds = existingModels.map(
      (m) => new AiAudioSeparationJobId(m.id),
    );
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );
    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(
    props: AiAudioSeparationJobSearchParams,
  ): Promise<AiAudioSeparationJobSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [items, total] = await Promise.all([
      this.prisma.aiAudioSeparationJob.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: { outputs: true },
      }),
      this.prisma.aiAudioSeparationJob.count({ where }),
    ]);

    return new AiAudioSeparationJobSearchResult({
      items: items.map((m) =>
        AiAudioSeparationJobModelMapper.toEntity(m as any),
      ),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  getEntity(): new (...args: any[]) => AiAudioSeparationJob {
    return AiAudioSeparationJob;
  }

  private buildWhereClause(
    filter: AiAudioSeparationJobFilter | null,
  ): Prisma.AiAudioSeparationJobWhereInput {
    if (!filter) return {};
    return {
      ...(filter.musician_id ? { musicianId: filter.musician_id } : {}),
      ...(filter.ai_audio_upload_id
        ? { aiAudioUploadId: filter.ai_audio_upload_id }
        : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.model_id ? { model_id: filter.model_id } : {}),
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
