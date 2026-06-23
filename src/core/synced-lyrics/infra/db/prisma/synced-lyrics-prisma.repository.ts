import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { SyncedLyrics, SyncedLyricsId } from "../../../domain";
import {
  ISyncedLyricsRepository,
  SyncedLyricsFilter,
  SyncedLyricsSearchParams,
  SyncedLyricsSearchResult,
} from "../../../domain";
import { SyncedLyricsModelMapper } from "./synced-lyrics-model-mapper";

export class SyncedLyricsPrismaRepository implements ISyncedLyricsRepository {
  sortableFields: string[] = [
    "created_at",
    "updated_at",
    "title",
    "artist",
    "lrc_version",
  ];

  constructor(private prisma: PrismaClient) {}

  private toPrismaOptionalJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null) {
      return Prisma.DbNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private sanitizeString(value: string): string {
    return String(value).replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      "",
    );
  }

  private sanitizeJson(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return this.sanitizeString(value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.map((v) => this.sanitizeJson(v));
    if (typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as any)) {
        const key = this.sanitizeString(k);
        out[key] = this.sanitizeJson(v);
      }
      return out;
    }
    return String(value);
  }

  private sanitizeModelProps(modelProps: any) {
    const safe = { ...(modelProps ?? {}) };
    if (typeof safe.lrc_raw === "string") {
      safe.lrc_raw = this.sanitizeString(safe.lrc_raw);
    }
    if (typeof safe.lrc_provider === "string")
      safe.lrc_provider = this.sanitizeString(safe.lrc_provider);
    if (typeof safe.lrc_hash === "string") {
      safe.lrc_hash = this.sanitizeString(safe.lrc_hash);
    }
    if (safe.lrc_provider_meta !== undefined)
      safe.lrc_provider_meta = this.sanitizeJson(safe.lrc_provider_meta);
    if (safe.lrc_normalized !== undefined)
      safe.lrc_normalized = this.sanitizeJson(safe.lrc_normalized);
    return safe;
  }

  async insert(entity: SyncedLyrics): Promise<void> {
    const id = entity.music_library_id.id;
    const modelProps = this.sanitizeModelProps(
      SyncedLyricsModelMapper.toModel(entity),
    );

    try {
      await this.prisma.musicLibrary.update({
        where: { id },
        data: {
          ...modelProps,
          lrc_normalized: this.toPrismaOptionalJson(modelProps.lrc_normalized),
          lrc_provider_meta: this.toPrismaOptionalJson(
            modelProps.lrc_provider_meta,
          ),
        } as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "musicLibrary.update(lrc-insert)",
      });
    }
  }

  async bulkInsert(entities: SyncedLyrics[]): Promise<void> {
    const updates = entities.map((entity) => {
      const id = entity.music_library_id.id;
      const modelProps = this.sanitizeModelProps(
        SyncedLyricsModelMapper.toModel(entity),
      );
      return this.prisma.musicLibrary.update({
        where: { id },
        data: {
          ...modelProps,
          lrc_normalized: this.toPrismaOptionalJson(modelProps.lrc_normalized),
          lrc_provider_meta: this.toPrismaOptionalJson(
            modelProps.lrc_provider_meta,
          ),
        } as any,
      });
    });

    try {
      await this.prisma.$transaction(updates);
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "musicLibrary.$transaction(lrc-bulk-insert)",
      });
    }
  }

  async update(entity: SyncedLyrics): Promise<void> {
    const id = entity.music_library_id.id;
    const modelProps = this.sanitizeModelProps(
      SyncedLyricsModelMapper.toModel(entity),
    );

    try {
      await this.prisma.musicLibrary.update({
        where: { id },
        data: {
          ...modelProps,
          lrc_normalized: this.toPrismaOptionalJson(modelProps.lrc_normalized),
          lrc_provider_meta: this.toPrismaOptionalJson(
            modelProps.lrc_provider_meta,
          ),
        } as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "musicLibrary.update(lrc-update)",
      });
    }
  }

  async delete(entity_id: SyncedLyricsId): Promise<void> {
    const id = entity_id.id;
    const now = new Date();

    try {
      await this.prisma.musicLibrary.update({
        where: { id },
        data: {
          lrc_raw: null,
          lrc_normalized: Prisma.DbNull,
          lrc_provider: null,
          lrc_provider_meta: Prisma.DbNull,
          lrc_hash: null,
          lrc_quality_flags: [],
          lrc_coverage_ms: null,
          lrc_has_word_timestamps: false,
          lrc_last_synced_at: now,
          lrc_version: { increment: 1 },
          updated_at: now,
        } as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "musicLibrary.update(lrc-delete)",
      });
    }
  }

  async findById(entity_id: SyncedLyricsId): Promise<SyncedLyrics | null> {
    const model = await this.prisma.musicLibrary.findUnique({
      where: { id: entity_id.id },
    });
    return model ? SyncedLyricsModelMapper.toEntity(model as any) : null;
  }

  async findAll(): Promise<SyncedLyrics[]> {
    const models = await this.prisma.musicLibrary.findMany();
    return models.map((m) => SyncedLyricsModelMapper.toEntity(m as any));
  }

  async findByIds(ids: SyncedLyricsId[]): Promise<SyncedLyrics[]> {
    const models = await this.prisma.musicLibrary.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => SyncedLyricsModelMapper.toEntity(m as any));
  }

  async existsById(
    ids: SyncedLyricsId[],
  ): Promise<{ exists: SyncedLyricsId[]; not_exists: SyncedLyricsId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.musicLibrary.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => new SyncedLyricsId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(
    props: SyncedLyricsSearchParams,
  ): Promise<SyncedLyricsSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, total] = await Promise.all([
      this.prisma.musicLibrary.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.musicLibrary.count({ where }),
    ]);

    const items = models.map((m) => SyncedLyricsModelMapper.toEntity(m as any));
    return new SyncedLyricsSearchResult({
      items,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: SyncedLyricsFilter | null) {
    if (!filter) return {};

    const where: Prisma.MusicLibraryWhereInput = {};

    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }

    if (filter.query) {
      const q = String(filter.query);
      where.OR = [
        {
          title: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          artist: {
            contains: q,
            mode: "insensitive",
          },
        },
      ];
    }

    if (typeof filter.has_lrc === "boolean") {
      where.lrc_raw = filter.has_lrc ? { not: null } : null;
    }

    if (filter.provider) {
      where.lrc_provider = String(filter.provider);
    }

    if (filter.hash) {
      where.lrc_hash = String(filter.hash);
    }

    return where;
  }

  private buildOrderByClause(
    sort?: string | null,
    sort_dir?: SortDirection | null,
  ) {
    const direction = (sort_dir ?? "desc") as Prisma.SortOrder;
    if (!sort) {
      return { created_at: "desc" as const };
    }

    if (!this.sortableFields.includes(sort)) {
      throw new InvalidArgumentError(`Invalid sort field: ${sort}`);
    }

    return { [sort]: direction } as any;
  }

  getEntity(): new (...args: any[]) => SyncedLyrics {
    return SyncedLyrics;
  }
}
