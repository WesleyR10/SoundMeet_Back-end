import { Prisma, PrismaClient } from "@prisma/client";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  ISyncedLyricsBulkJobRepository,
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobFilter,
  SyncedLyricsBulkJobId,
  SyncedLyricsBulkJobSearchParams,
  SyncedLyricsBulkJobSearchResult,
} from "../../../domain";
import { SyncedLyricsBulkJobModelMapper } from "./synced-lyrics-bulk-job-model-mapper";

export class SyncedLyricsBulkJobPrismaRepository implements ISyncedLyricsBulkJobRepository {
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: SyncedLyricsBulkJob): Promise<void> {
    const modelProps = SyncedLyricsBulkJobModelMapper.toModel(entity);
    try {
      await this.prisma.syncedLyricsBulkJob.create({ data: modelProps as any });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.synced_lyrics_bulk_job_id.id,
        operation: "syncedLyricsBulkJob.create",
      });
    }
  }

  async bulkInsert(entities: SyncedLyricsBulkJob[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      SyncedLyricsBulkJobModelMapper.toModel(entity),
    );
    try {
      await this.prisma.syncedLyricsBulkJob.createMany({
        data: modelsProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "syncedLyricsBulkJob.createMany",
      });
    }
  }

  async update(entity: SyncedLyricsBulkJob): Promise<void> {
    const id = entity.synced_lyrics_bulk_job_id.id;
    const modelProps = SyncedLyricsBulkJobModelMapper.toModel(entity);
    try {
      await this.prisma.syncedLyricsBulkJob.update({
        where: { id },
        data: modelProps as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "syncedLyricsBulkJob.update",
      });
    }
  }

  async delete(id: SyncedLyricsBulkJobId): Promise<void> {
    try {
      await this.prisma.syncedLyricsBulkJob.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "syncedLyricsBulkJob.delete",
      });
    }
  }

  async findById(
    entity_id: SyncedLyricsBulkJobId,
  ): Promise<SyncedLyricsBulkJob | null> {
    const model = await this.prisma.syncedLyricsBulkJob.findUnique({
      where: { id: entity_id.id },
    });
    return model ? SyncedLyricsBulkJobModelMapper.toEntity(model as any) : null;
  }

  async findAll(): Promise<SyncedLyricsBulkJob[]> {
    const models = await this.prisma.syncedLyricsBulkJob.findMany();
    return models.map((m) => SyncedLyricsBulkJobModelMapper.toEntity(m as any));
  }

  async findByIds(
    ids: SyncedLyricsBulkJobId[],
  ): Promise<SyncedLyricsBulkJob[]> {
    const models = await this.prisma.syncedLyricsBulkJob.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((m) => SyncedLyricsBulkJobModelMapper.toEntity(m as any));
  }

  async existsById(ids: SyncedLyricsBulkJobId[]): Promise<{
    exists: SyncedLyricsBulkJobId[];
    not_exists: SyncedLyricsBulkJobId[];
  }> {
    const existingModels = await this.prisma.syncedLyricsBulkJob.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const existingIds = existingModels.map(
      (m) => new SyncedLyricsBulkJobId(m.id),
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
    props: SyncedLyricsBulkJobSearchParams,
  ): Promise<SyncedLyricsBulkJobSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [items, total] = await Promise.all([
      this.prisma.syncedLyricsBulkJob.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.syncedLyricsBulkJob.count({ where }),
    ]);

    return new SyncedLyricsBulkJobSearchResult({
      items: items.map((m) =>
        SyncedLyricsBulkJobModelMapper.toEntity(m as any),
      ),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  getEntity(): new (...args: any[]) => SyncedLyricsBulkJob {
    return SyncedLyricsBulkJob;
  }

  private buildWhereClause(
    filter: SyncedLyricsBulkJobFilter | null,
  ): Prisma.SyncedLyricsBulkJobWhereInput {
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
