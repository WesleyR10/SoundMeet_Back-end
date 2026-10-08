import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  Performance,
  PerformanceId,
} from "../../../domain/performance.aggregate";
import {
  IPerformanceRepository,
  PerformanceFilter,
  PerformanceSearchParams,
  PerformanceSearchResult,
} from "../../../domain/performance.repository";
import { PerformanceModel } from "./performance-model";
import { PerformanceModelMapper } from "./performance-model-mapper";

const INCLUDE_RELATIONS = {
  songs: { orderBy: { position: "asc" as const } },
};

export class PerformancePrismaRepository implements IPerformanceRepository {
  sortableFields: string[] = ["started_at", "ended_at", "created_at"];

  /** Domínio usa snake_case; as colunas de ordenação do Prisma, camelCase. */
  private static readonly SORT_COLUMNS: Record<string, string> = {
    started_at: "startedAt",
    ended_at: "endedAt",
    created_at: "created_at",
  };

  constructor(private readonly prisma: PrismaClient) {}

  async insert(entity: Performance): Promise<void> {
    try {
      await this.prisma.performance.create({
        data: {
          ...(PerformanceModelMapper.toModel(entity) as any),
          songs: {
            // No create aninhado a FK vem da relação — repassar `performanceId`
            // explode com "Unknown argument". Mesma pegadinha já registrada em
            // `repertoire-prisma.repository.ts`.
            create: entity.songs.map((s) => {
              const { performanceId: _performanceId, ...song } =
                PerformanceModelMapper.songToModel(s, entity.performance_id.id);
              return song;
            }),
          },
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.performance_id.id,
        operation: "performance.insert",
      });
    }
  }

  async bulkInsert(entities: Performance[]): Promise<void> {
    for (const entity of entities) {
      await this.insert(entity);
    }
  }

  /**
   * Apaga e recria as músicas do set dentro de uma transação — mesmo padrão de
   * `repertoire`.
   *
   * Reescrever o set inteiro a cada música parece desperdício, e é: um set de
   * 30 músicas custa 30 deletes + 30 inserts a cada 4 minutos. Aceito de
   * propósito, porque a alternativa (diff incremental) é um segundo padrão de
   * persistência de entidade embutida neste repositório — e a unique
   * `(performanceId, position)` torna qualquer diff parcial uma fonte de
   * conflito difícil de depurar. Os ids vêm do agregado, então o churn não
   * troca identidade de linha.
   */
  async update(entity: Performance): Promise<void> {
    const model = PerformanceModelMapper.toModel(entity);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.performance.update({
          where: { id: model.id },
          data: model as any,
        });

        await tx.performedSong.deleteMany({
          where: { performanceId: model.id },
        });

        if (entity.songs.length > 0) {
          await tx.performedSong.createMany({
            data: entity.songs.map((s) =>
              PerformanceModelMapper.songToModel(s, model.id),
            ),
          });
        }
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.performance_id.id,
        operation: "performance.update",
      });
    }
  }

  async delete(id: PerformanceId): Promise<void> {
    try {
      await this.prisma.performance.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "performance.delete",
      });
    }
  }

  async findById(id: PerformanceId): Promise<Performance | null> {
    const model = await this.prisma.performance.findUnique({
      where: { id: id.id },
      include: INCLUDE_RELATIONS,
    });
    return model
      ? PerformanceModelMapper.toEntity(model as unknown as PerformanceModel)
      : null;
  }

  async findByIds(ids: PerformanceId[]): Promise<Performance[]> {
    const models = await this.prisma.performance.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      include: INCLUDE_RELATIONS,
    });
    return models.map((m) =>
      PerformanceModelMapper.toEntity(m as unknown as PerformanceModel),
    );
  }

  async findAll(): Promise<Performance[]> {
    const models = await this.prisma.performance.findMany({
      include: INCLUDE_RELATIONS,
    });
    return models.map((m) =>
      PerformanceModelMapper.toEntity(m as unknown as PerformanceModel),
    );
  }

  async existsById(
    ids: PerformanceId[],
  ): Promise<{ exists: PerformanceId[]; not_exists: PerformanceId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.prisma.performance.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));

    return {
      exists: ids.filter((i) => existingIds.has(i.id)),
      not_exists: ids.filter((i) => !existingIds.has(i.id)),
    };
  }

  async findLiveByEventAndMusician(params: {
    event_id: string;
    musician_id: string;
  }): Promise<Performance | null> {
    const model = await this.prisma.performance.findFirst({
      where: {
        eventId: params.event_id,
        musicianId: params.musician_id,
        status: "live",
      },
      include: INCLUDE_RELATIONS,
    });
    return model
      ? PerformanceModelMapper.toEntity(model as unknown as PerformanceModel)
      : null;
  }

  async findEndedByMusician(params: {
    musician_id: string;
    establishment_id?: string | null;
    limit?: number;
    started_from?: Date | null;
  }): Promise<Performance[]> {
    const models = await this.prisma.performance.findMany({
      where: {
        musicianId: params.musician_id,
        status: "ended",
        ...(params.establishment_id
          ? { establishmentId: params.establishment_id }
          : {}),
        ...(params.started_from
          ? { startedAt: { gte: params.started_from } }
          : {}),
      },
      include: INCLUDE_RELATIONS,
      orderBy: { startedAt: "desc" },
      ...(params.limit ? { take: params.limit } : {}),
    });
    return models.map((m) =>
      PerformanceModelMapper.toEntity(m as unknown as PerformanceModel),
    );
  }

  /**
   * Agregação NO banco: trazer todo o histórico de sets para a aplicação só
   * para contar seria varredura inteira a cada sugestão de setlist. Mesmo
   * cuidado do `aggregateForTarget` de `review`.
   *
   * O agrupamento por `libraryId` **e** por título/artista existe porque música
   * tocada fora da biblioteca não tem id — e ela conta tanto quanto as outras
   * como evidência daquele local.
   */
  async countPlaysByMusicianAtEstablishment(params: {
    musician_id: string;
    establishment_id: string;
  }): Promise<
    Array<{
      music_library_id: string | null;
      title: string;
      artist: string;
      plays: number;
      last_played_at: Date;
    }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        music_library_id: string | null;
        title: string;
        artist: string;
        plays: bigint;
        last_played_at: Date;
      }>
    >`
      SELECT
        MIN(ps."libraryId")                                     AS music_library_id,
        MIN(ps."title")                                         AS title,
        MIN(ps."artist")                                        AS artist,
        COUNT(*)                                                AS plays,
        MAX(ps."startedAt")                                     AS last_played_at
      FROM "performed_songs" ps
      JOIN "performances" p ON p."id" = ps."performanceId"
      WHERE p."musicianId" = ${params.musician_id}
        AND p."establishmentId" = ${params.establishment_id}
      GROUP BY COALESCE(
        ps."libraryId",
        LOWER(ps."title") || '::' || LOWER(ps."artist")
      )
      ORDER BY plays DESC, last_played_at DESC
    `;

    // `COUNT(*)` volta BIGINT do Postgres, que o driver entrega como `bigint`.
    // Sem esta conversão o número atravessa a API e o `JSON.stringify` do Nest
    // lança "Do not know how to serialize a BigInt" — em produção, no primeiro
    // acesso.
    return rows.map((r) => ({
      music_library_id: r.music_library_id,
      title: r.title,
      artist: r.artist,
      plays: Number(r.plays),
      last_played_at: r.last_played_at,
    }));
  }

  async countDistinctSongsByMusician(musician_id: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(DISTINCT COALESCE(
               ps."libraryId",
               LOWER(ps."title") || '::' || LOWER(ps."artist")
             )) AS total
      FROM "performed_songs" ps
      JOIN "performances" p ON p."id" = ps."performanceId"
      WHERE p."musicianId" = ${musician_id}
    `;
    return Number(rows[0]?.total ?? 0);
  }

  async search(
    props: PerformanceSearchParams,
  ): Promise<PerformanceSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const where = this.buildWhereClause(props.filter);

    const [models, total] = await Promise.all([
      this.prisma.performance.findMany({
        where,
        include: INCLUDE_RELATIONS,
        orderBy: this.buildOrderByClause(props.sort, props.sort_dir),
        skip: offset,
        take: props.per_page,
      }),
      this.prisma.performance.count({ where }),
    ]);

    return new PerformanceSearchResult({
      items: models.map((m) =>
        PerformanceModelMapper.toEntity(m as unknown as PerformanceModel),
      ),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: PerformanceFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.musician_id) where.musicianId = filter.musician_id;
    if (filter.band_id) where.bandId = filter.band_id;
    if (filter.establishment_id)
      where.establishmentId = filter.establishment_id;
    if (filter.event_id) where.eventId = filter.event_id;
    if (filter.status) where.status = filter.status;

    return where;
  }

  private buildOrderByClause(sort: string | null, sort_dir: string | null) {
    // Show mais recente primeiro. Sort fora da allowlist é ignorado — o
    // orderBy do Prisma explode com coluna inexistente.
    if (!sort || !this.sortableFields.includes(sort)) {
      return { startedAt: "desc" as const };
    }
    const column =
      PerformancePrismaRepository.SORT_COLUMNS[sort] ?? "startedAt";
    return { [column]: sort_dir === "asc" ? "asc" : "desc" } as any;
  }

  getEntity(): new (...args: any[]) => Performance {
    return Performance;
  }
}
