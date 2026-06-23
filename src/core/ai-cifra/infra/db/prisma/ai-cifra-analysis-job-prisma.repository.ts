import { Prisma, PrismaClient } from "@prisma/client";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import {
  AiCifraAnalysisJobFilter,
  AiCifraAnalysisJobSearchParams,
  AiCifraAnalysisJobSearchResult,
  IAiCifraAnalysisJobRepository,
} from "../../../domain/ai-cifra-analysis-job.repository";
import { AiCifraAnalysisJobModelMapper } from "./ai-cifra-analysis-job-model-mapper";

export class AiCifraAnalysisJobPrismaRepository implements IAiCifraAnalysisJobRepository {
  sortableFields: string[] = [
    "created_at",
    "updated_at",
    "status",
    "progress_percent",
  ];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: AiCifraAnalysisJob): Promise<void> {
    const modelProps = AiCifraAnalysisJobModelMapper.toModel(entity);
    try {
      await this.prisma.aiCifraAnalysisJob.create({ data: modelProps as any });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.ai_cifra_analysis_job_id.id,
        operation: "aiCifraAnalysisJob.create",
      });
    }
  }

  async bulkInsert(entities: AiCifraAnalysisJob[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      AiCifraAnalysisJobModelMapper.toModel(entity),
    );
    try {
      await this.prisma.aiCifraAnalysisJob.createMany({
        data: modelsProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "aiCifraAnalysisJob.createMany",
      });
    }
  }

  async update(entity: AiCifraAnalysisJob): Promise<void> {
    const id = entity.ai_cifra_analysis_job_id.id;
    const modelProps = AiCifraAnalysisJobModelMapper.toModel(entity);
    try {
      await this.prisma.aiCifraAnalysisJob.update({
        where: { id },
        data: modelProps as any,
      });

      if (entity.status === "completed") {
        const upload = await this.prisma.aiCifraUpload.findUnique({
          where: { id: entity.ai_cifra_upload_id.id },
          select: { musicLibraryId: true },
        });

        const musicLibraryId = upload?.musicLibraryId;
        if (musicLibraryId && entity.result) {
          const bpm =
            typeof entity.result.bpm === "number" &&
            Number.isFinite(entity.result.bpm)
              ? Math.round(entity.result.bpm)
              : null;

          await this.prisma.musicLibrary.updateMany({
            where: {
              id: musicLibraryId,
              musicianId: entity.musician_id.id,
            },
            data: {
              bpm,
              key: entity.result.key ?? null,
              chords: { timeline: entity.result.chords ?? [] } as any,
              structure_segments: entity.result.segments ?? [],
            },
          });
        }
      }
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "aiCifraAnalysisJob.update",
      });
    }
  }

  async delete(id: AiCifraAnalysisJobId): Promise<void> {
    try {
      await this.prisma.aiCifraAnalysisJob.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "aiCifraAnalysisJob.delete",
      });
    }
  }

  async findById(
    entity_id: AiCifraAnalysisJobId,
  ): Promise<AiCifraAnalysisJob | null> {
    const model = await this.prisma.aiCifraAnalysisJob.findUnique({
      where: { id: entity_id.id },
    });
    return model ? AiCifraAnalysisJobModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: AiCifraAnalysisJobId[]): Promise<AiCifraAnalysisJob[]> {
    const models = await this.prisma.aiCifraAnalysisJob.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) => AiCifraAnalysisJobModelMapper.toEntity(m as any));
  }

  async findAll(): Promise<AiCifraAnalysisJob[]> {
    const models = await this.prisma.aiCifraAnalysisJob.findMany();
    return models.map((m) => AiCifraAnalysisJobModelMapper.toEntity(m as any));
  }

  async existsById(ids: AiCifraAnalysisJobId[]): Promise<{
    exists: AiCifraAnalysisJobId[];
    not_exists: AiCifraAnalysisJobId[];
  }> {
    const existingModels = await this.prisma.aiCifraAnalysisJob.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const existingIds = existingModels.map(
      (m) => new AiCifraAnalysisJobId(m.id),
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
    props: AiCifraAnalysisJobSearchParams,
  ): Promise<AiCifraAnalysisJobSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [items, total] = await Promise.all([
      this.prisma.aiCifraAnalysisJob.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.aiCifraAnalysisJob.count({ where }),
    ]);

    return new AiCifraAnalysisJobSearchResult({
      items: items.map((m) => AiCifraAnalysisJobModelMapper.toEntity(m as any)),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  getEntity(): new (...args: any[]) => AiCifraAnalysisJob {
    return AiCifraAnalysisJob;
  }

  private buildWhereClause(
    filter: AiCifraAnalysisJobFilter | null,
  ): Prisma.AiCifraAnalysisJobWhereInput {
    if (!filter) return {};
    return {
      ...(filter.musician_id ? { musicianId: filter.musician_id } : {}),
      ...(filter.ai_cifra_upload_id
        ? { aiCifraUploadId: filter.ai_cifra_upload_id }
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
