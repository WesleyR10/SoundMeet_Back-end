import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../domain/music-library.aggregate";
import {
  IMusicLibraryRepository,
  MusicLibraryFilter,
  MusicLibrarySearchParams,
  MusicLibrarySearchResult,
  SearchSongCatalogInput,
  SongCatalogEntry,
} from "../../../domain/music-library.repository";
import { MusicLibraryModel } from "./music-library-model";
import { MusicLibraryModelMapper } from "./music-library-model.mapper";

export class MusicLibraryPrismaRepository implements IMusicLibraryRepository {
  sortableFields: string[] = [
    "title",
    "artist",
    "difficulty",
    "created_at",
    "updated_at",
  ];

  constructor(private prisma: PrismaClient) {}

  private toPrismaOptionalJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null || value === undefined) {
      return Prisma.DbNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toPrismaCreateData(model: MusicLibraryModel) {
    return {
      id: model.id,
      musicianId: model.musicianId,
      title: model.title,
      artist: model.artist,
      genre: model.genre,
      key: model.key,
      bpm: model.bpm,
      lyrics: model.lyrics,
      chords: this.toPrismaOptionalJson(model.chords),
      structure_segments: this.toPrismaOptionalJson(model.structure_segments),
      chord_sheet: this.toPrismaOptionalJson(model.chord_sheet),
      chord_sheet_version: model.chord_sheet_version,
      renderable_chord_sheet: this.toPrismaOptionalJson(
        model.renderable_chord_sheet,
      ),
      renderable_chord_sheet_version: model.renderable_chord_sheet_version,
      notes: model.notes,
      difficulty: model.difficulty,
      isFavorite: model.isFavorite,
      source: model.source,
      sourceId: model.sourceId,
      lrc_raw: model.lrc_raw,
      lrc_normalized: this.toPrismaOptionalJson(model.lrc_normalized),
      lrc_provider: model.lrc_provider,
      lrc_provider_meta: this.toPrismaOptionalJson(model.lrc_provider_meta),
      lrc_hash: model.lrc_hash,
      lrc_version: model.lrc_version,
      lrc_pipeline_version: model.lrc_pipeline_version,
      lrc_quality_flags: model.lrc_quality_flags,
      lrc_coverage_ms: model.lrc_coverage_ms,
      lrc_has_word_timestamps: model.lrc_has_word_timestamps,
      lrc_last_synced_at: model.lrc_last_synced_at,
      // O mapper sempre produziu duration_seconds, mas esta lista o omitia —
      // então insert e update descartavam o campo em silêncio e a coluna ficava
      // NULL mesmo com o worker devolvendo a duração em artifacts.
      duration_seconds: model.duration_seconds,
      // ⚠️ Esta lista é explícita: campo do mapper que não aparecer AQUI é
      // descartado em silêncio no insert e no update — foi exatamente o que
      // aconteceu com `duration_seconds` (comentário acima).
      spotifyTrackId: model.spotifyTrackId,
      spotifyMatchScore: model.spotifyMatchScore,
      spotifyCheckedAt: model.spotifyCheckedAt,
      created_at: model.created_at,
      updated_at: model.updated_at,
    };
  }

  async insert(entity: MusicLibrary): Promise<void> {
    const model = MusicLibraryModelMapper.toModel(entity);
    try {
      await this.prisma.musicLibrary.create({
        data: this.toPrismaCreateData(model),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.music_library_id.id,
        operation: "musicLibrary.create",
      });
    }
  }

  async bulkInsert(entities: MusicLibrary[]): Promise<void> {
    try {
      await this.prisma.$transaction(
        entities.map((entity) =>
          this.prisma.musicLibrary.create({
            data: this.toPrismaCreateData(
              MusicLibraryModelMapper.toModel(entity),
            ),
          }),
        ),
      );
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "musicLibrary.createMany",
      });
    }
  }

  async update(entity: MusicLibrary): Promise<void> {
    const id = entity.music_library_id.id;
    const model = MusicLibraryModelMapper.toModel(entity);
    const {
      id: _id,
      musicianId: _musicianId,
      ...data
    } = this.toPrismaCreateData(model);

    try {
      await this.prisma.musicLibrary.update({
        where: { id },
        data,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "musicLibrary.update",
      });
    }
  }

  async delete(id: MusicLibraryId): Promise<void> {
    try {
      await this.prisma.musicLibrary.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "musicLibrary.delete",
      });
    }
  }

  async findById(entity_id: MusicLibraryId): Promise<MusicLibrary | null> {
    const model = await this.prisma.musicLibrary.findUnique({
      where: { id: entity_id.id },
    });

    return model
      ? MusicLibraryModelMapper.toEntity(model as MusicLibraryModel)
      : null;
  }

  async findByIds(ids: MusicLibraryId[]): Promise<MusicLibrary[]> {
    const models = await this.prisma.musicLibrary.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((model) =>
      MusicLibraryModelMapper.toEntity(model as MusicLibraryModel),
    );
  }

  async findAll(): Promise<MusicLibrary[]> {
    const models = await this.prisma.musicLibrary.findMany();
    return models.map((model) =>
      MusicLibraryModelMapper.toEntity(model as MusicLibraryModel),
    );
  }

  async existsById(
    ids: MusicLibraryId[],
  ): Promise<{ exists: MusicLibraryId[]; not_exists: MusicLibraryId[] }> {
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

    const existingIds = existingModels.map((m) => new MusicLibraryId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(
    props: MusicLibrarySearchParams,
  ): Promise<MusicLibrarySearchResult> {
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

    const entities = models.map((model) =>
      MusicLibraryModelMapper.toEntity(model as MusicLibraryModel),
    );

    return new MusicLibrarySearchResult({
      items: entities,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: MusicLibraryFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }

    if (filter.title) {
      where.title = {
        contains: filter.title,
        mode: "insensitive",
      };
    }

    if (filter.artist) {
      where.artist = {
        contains: filter.artist,
        mode: "insensitive",
      };
    }

    if (filter.genre) {
      where.genre = {
        contains: filter.genre,
        mode: "insensitive",
      };
    }

    if (filter.key) {
      where.key = filter.key;
    }

    if (filter.source) {
      where.source = {
        contains: filter.source,
        mode: "insensitive",
      };
    }

    if (
      filter.difficulty !== null &&
      filter.difficulty !== undefined &&
      Number.isFinite(filter.difficulty)
    ) {
      where.difficulty = filter.difficulty;
    }

    if (filter.is_favorite !== null && filter.is_favorite !== undefined) {
      where.isFavorite = filter.is_favorite;
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

  async findPendingSpotifyResolution(limit: number): Promise<MusicLibrary[]> {
    const models = await this.prisma.musicLibrary.findMany({
      where: { spotifyCheckedAt: null },
      // Mais nova primeiro: a música recém-analisada é a que alguém vai tocar,
      // e é para ela que o link precisa existir antes do próximo show.
      orderBy: { created_at: "desc" },
      take: Math.max(0, limit),
    });
    return models.map((m) =>
      MusicLibraryModelMapper.toEntity(m as unknown as MusicLibraryModel),
    );
  }

  async searchSongCatalog(
    input: SearchSongCatalogInput,
  ): Promise<SongCatalogEntry[]> {
    const term = input.term?.trim() ?? "";
    /*
     * No escopo `repertoire` o recorte é a biblioteca do próprio músico, sem
     * o filtro de cifra: o repertório dele é o que ele toca, tenha a
     * plataforma analisado a música ou não.
     *
     * `$queryRaw` porque o que esta consulta faz não existe no Prisma Client:
     * `groupBy` não aceita expressão (`lower(trim(title))`) como chave, e sem
     * normalizar o par "Garota de Ipanema" e "garota de ipanema " viram duas
     * entradas do catálogo. O `%` vai como PARÂMETRO (`${like}`), nunca
     * concatenado no template — `$queryRaw` só parametriza o que é
     * interpolado, e montar o LIKE por string reabriria injeção.
     */
    const like = `%${term}%`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        title: string;
        artist: string;
        genre: string | null;
        musicians_count: bigint | number;
        library_id: string | null;
      }>
    >`
      SELECT
        MIN(ml."title")  AS title,
        MIN(ml."artist") AS artist,
        MIN(ml."genre")  AS genre,
        COUNT(DISTINCT ml."musicianId") AS musicians_count,
        MAX(CASE WHEN ml."musicianId" = ${input.musician_id} THEN ml."id" END)
          AS library_id
      FROM "music_library" ml
      WHERE (
          CASE
            WHEN ${input.scope}::text = 'repertoire'
              THEN ml."musicianId" = ${input.musician_id}
            ELSE (ml."lrc_normalized" IS NOT NULL OR ml."chords" IS NOT NULL)
          END
        )
        AND (
          ${term} = ''
          OR ml."title"  ILIKE ${like}
          OR ml."artist" ILIKE ${like}
        )
      GROUP BY lower(btrim(ml."title")), lower(btrim(ml."artist"))
      ORDER BY
        (MAX(CASE WHEN ml."musicianId" = ${input.musician_id} THEN 1 ELSE 0 END)) DESC,
        COUNT(DISTINCT ml."musicianId") DESC,
        MIN(ml."title") ASC
      LIMIT ${Math.max(0, input.limit)}
    `;

    return rows.map((row) => ({
      title: row.title,
      artist: row.artist,
      genre: row.genre,
      // COUNT() do Postgres volta como BigInt no driver — `Number` aqui, senão
      // o JSON.stringify da resposta HTTP lança "Do not know how to serialize
      // a BigInt".
      musicians_count: Number(row.musicians_count),
      library_id: row.library_id,
    }));
  }

  getEntity(): new (...args: any[]) => MusicLibrary {
    return MusicLibrary;
  }
}
