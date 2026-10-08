import { Prisma, PrismaClient } from "@prisma/client";

import {
  IPersonalChordSheetReadModel,
  PersonalChordSheetSummaryPage,
  PersonalChordSheetSummaryQuery,
  PersonalChordSheetSummaryReadModel,
} from "../../../application/gateways/personal-chord-sheet-read-model.interface";
import {
  PERSONAL_CHORD_SHEET_SHARE_SCOPES,
  type PersonalChordSheetShareScope,
} from "../../../domain/personal-chord-sheet.aggregate";
import { ChordSheetViewSettings } from "../../../domain/value-objects/chord-sheet-view-settings.vo";

/** Whitelist de ordenação — o nome da coluna entra na SQL, nunca como parâmetro. */
const SORTABLE_COLUMNS: Record<string, Prisma.Sql> = {
  created_at: Prisma.sql`"created_at"`,
  updated_at: Prisma.sql`"updated_at"`,
  shared_at: Prisma.sql`"shared_at"`,
};

type SummaryRow = {
  id: string;
  musician_id: string;
  music_library_id: string;
  base_version: number;
  base_fingerprint: string;
  base_pipeline_version: number;
  edit_count: number;
  view: unknown;
  notes: string | null;
  share_scope: string;
  shared_at: Date | null;
  reconcile_status: string;
  created_at: Date;
  updated_at: Date;
};

/**
 * Projeção de listagem em SQL cru.
 *
 * `$queryRaw` aqui não é preciosismo: `edit_count` é `jsonb_array_length` da
 * coluna `edits`, e essa é a única forma de contar as correções sem trazer os
 * até 60 KB de JSON de cada linha para o Node. Com `select` do Prisma seria
 * preciso escolher entre carregar tudo ou não ter a contagem.
 *
 * Toda interpolação de valor passa por `Prisma.sql` (parametrizada); só nomes de
 * coluna vindos da whitelist SORTABLE_COLUMNS entram como texto. Precedente:
 * RequestPrismaRepository.search.
 */
export class PersonalChordSheetPrismaReadModel implements IPersonalChordSheetReadModel {
  constructor(private readonly prisma: PrismaClient) {}

  async searchSummaries(
    query: PersonalChordSheetSummaryQuery,
  ): Promise<PersonalChordSheetSummaryPage> {
    const conditions: Prisma.Sql[] = [];

    if (query.musician_id) {
      conditions.push(Prisma.sql`"musician_id" = ${query.musician_id}`);
    }
    if (query.music_library_id) {
      conditions.push(
        Prisma.sql`"music_library_id" = ${query.music_library_id}`,
      );
    }
    if (query.share_scope) {
      conditions.push(Prisma.sql`"share_scope" = ${query.share_scope}`);
    }
    if (query.reconcile_status) {
      conditions.push(
        Prisma.sql`"reconcile_status" = ${query.reconcile_status}`,
      );
    }

    const whereSql =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
        : Prisma.sql``;

    const sortSql =
      SORTABLE_COLUMNS[query.sort ?? ""] ?? SORTABLE_COLUMNS.updated_at;
    const dirSql =
      query.sort_dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const offset = (query.page - 1) * query.per_page;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        SELECT
          "id",
          "musician_id",
          "music_library_id",
          "base_version",
          "base_fingerprint",
          "base_pipeline_version",
          COALESCE(jsonb_array_length("edits"), 0)::int AS "edit_count",
          "view",
          "notes",
          "share_scope",
          "shared_at",
          "reconcile_status",
          "created_at",
          "updated_at"
        FROM "personal_chord_sheets"
        ${whereSql}
        ORDER BY ${sortSql} ${dirSql} NULLS LAST, "id" ASC
        OFFSET ${offset}
        LIMIT ${query.per_page}
      `),
      this.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "personal_chord_sheets"
        ${whereSql}
      `),
    ]);

    return {
      items: rows.map((row) => toSummary(row)),
      total: Number(countRows[0]?.count ?? 0),
    };
  }
}

function toSummary(row: SummaryRow): PersonalChordSheetSummaryReadModel {
  return {
    personal_chord_sheet_id: row.id,
    music_library_id: row.music_library_id,
    musician_id: row.musician_id,
    base_version: row.base_version,
    base_fingerprint: row.base_fingerprint,
    base_pipeline_version: row.base_pipeline_version,
    edit_count: Number(row.edit_count ?? 0),
    // Reaproveita o VO: `view` é Json e pode estar velha ou corrompida, e
    // fromJSON já é a tolerância a formato antigo usada na carga do agregado.
    view: ChordSheetViewSettings.fromJSON(row.view).toJSON(),
    notes: row.notes,
    share_scope: coerceShareScope(row.share_scope),
    shared_at: row.shared_at,
    reconcile_status:
      row.reconcile_status === "base_updated" ? "base_updated" : "clean",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Escopo desconhecido → o mais restritivo. Mesma regra do model-mapper. */
function coerceShareScope(raw: unknown): PersonalChordSheetShareScope {
  return PERSONAL_CHORD_SHEET_SHARE_SCOPES.includes(
    raw as PersonalChordSheetShareScope,
  )
    ? (raw as PersonalChordSheetShareScope)
    : "private";
}
