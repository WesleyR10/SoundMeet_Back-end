import {
  IPersonalChordSheetReadModel,
  PersonalChordSheetSummaryPage,
  PersonalChordSheetSummaryQuery,
  PersonalChordSheetSummaryReadModel,
} from "../../../application/gateways/personal-chord-sheet-read-model.interface";
import { PersonalChordSheet } from "../../../domain/personal-chord-sheet.aggregate";
import { PersonalChordSheetInMemoryRepository } from "./personal-chord-sheet-in-memory.repository";

const SORTABLE = new Set(["created_at", "updated_at", "shared_at"]);

/**
 * Read-model in-memory — projeta a partir dos MESMOS agregados do repositório
 * in-memory, para que teste de use-case não precise de Postgres.
 *
 * Aqui `edit_count` é `edits.length` porque os agregados já estão em memória; no
 * Postgres é `jsonb_array_length`, e é justamente essa diferença que justifica a
 * projeção existir. O contrato observável (mesmos campos, mesma ordenação,
 * mesma paginação) é idêntico — é o que os testes cobram.
 */
export class PersonalChordSheetInMemoryReadModel implements IPersonalChordSheetReadModel {
  constructor(private readonly repo: PersonalChordSheetInMemoryRepository) {}

  async searchSummaries(
    query: PersonalChordSheetSummaryQuery,
  ): Promise<PersonalChordSheetSummaryPage> {
    const all = await this.repo.findAll();

    const filtered = all.filter((s) => {
      if (query.musician_id && s.musician_id !== query.musician_id)
        return false;
      if (
        query.music_library_id &&
        s.music_library_id !== query.music_library_id
      ) {
        return false;
      }
      if (query.share_scope && s.share_scope !== query.share_scope)
        return false;
      if (
        query.reconcile_status &&
        s.reconcile_status !== query.reconcile_status
      ) {
        return false;
      }
      return true;
    });

    const sortField = SORTABLE.has(query.sort ?? "")
      ? (query.sort as "created_at" | "updated_at" | "shared_at")
      : "updated_at";
    const dir = query.sort_dir === "asc" ? 1 : -1;

    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortField]?.getTime() ?? 0;
      const bv = b[sortField]?.getTime() ?? 0;
      if (av === bv) {
        // Desempate estável pelo id — espelha o "NULLS LAST, id ASC" da SQL.
        return a.personal_chord_sheet_id.id < b.personal_chord_sheet_id.id
          ? -1
          : 1;
      }
      return av < bv ? dir : -dir;
    });

    const offset = (query.page - 1) * query.per_page;

    return {
      items: sorted
        .slice(offset, offset + query.per_page)
        .map((s) => toSummary(s)),
      total: filtered.length,
    };
  }
}

function toSummary(
  sheet: PersonalChordSheet,
): PersonalChordSheetSummaryReadModel {
  return {
    personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
    music_library_id: sheet.music_library_id,
    musician_id: sheet.musician_id,
    base_version: sheet.base_version,
    base_fingerprint: sheet.base_fingerprint,
    base_pipeline_version: sheet.base_pipeline_version,
    edit_count: sheet.edits.length,
    view: sheet.view.toJSON(),
    notes: sheet.notes,
    share_scope: sheet.share_scope,
    shared_at: sheet.shared_at,
    reconcile_status: sheet.reconcile_status,
    created_at: sheet.created_at,
    updated_at: sheet.updated_at,
  };
}
