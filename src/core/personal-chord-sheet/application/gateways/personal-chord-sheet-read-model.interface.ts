import type {
  PersonalChordSheetReconcileStatus,
  PersonalChordSheetShareScope,
} from "../../domain/personal-chord-sheet.aggregate";
import type { ChordSheetViewSettingsProps } from "../../domain/value-objects/chord-sheet-view-settings.vo";

/**
 * Uma linha de listagem SEM o array de edits.
 *
 * O agregado carrega até 500 ChordEdit (~60 KB por linha) num único campo Json.
 * Numa página de 20 forks isso é mais de 1 MB lido do banco e serializado para
 * devolver uma tela que só mostra título, tom e quantas correções existem. Para
 * a listagem o que importa é `edit_count`, e ele é calculado NO BANCO
 * (jsonb_array_length) — a coluna nunca sai do Postgres.
 */
export type PersonalChordSheetSummaryReadModel = {
  personal_chord_sheet_id: string;
  music_library_id: string;
  musician_id: string;
  base_version: number;
  base_fingerprint: string;
  base_pipeline_version: number;
  edit_count: number;
  view: Required<ChordSheetViewSettingsProps>;
  notes: string | null;
  share_scope: PersonalChordSheetShareScope;
  shared_at: Date | null;
  reconcile_status: PersonalChordSheetReconcileStatus;
  created_at: Date;
  updated_at: Date;
};

export type PersonalChordSheetSummaryQuery = {
  musician_id?: string | null;
  music_library_id?: string | null;
  share_scope?: PersonalChordSheetShareScope | null;
  reconcile_status?: PersonalChordSheetReconcileStatus | null;
  page: number;
  per_page: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
};

export type PersonalChordSheetSummaryPage = {
  items: PersonalChordSheetSummaryReadModel[];
  total: number;
};

/**
 * Read-model de listagem — precedente: IChordSheetReadModel /
 * IRenderableChordSheetReadModel em src/core/synced-lyrics.
 *
 * Fica separado do repositório de propósito: o repositório existe para carregar
 * e persistir o AGREGADO íntegro, e uma projeção parcial não é um agregado. É a
 * mesma separação que o projeto já faz entre UserScore (ledger) e UserPoints
 * (projeção).
 */
export interface IPersonalChordSheetReadModel {
  searchSummaries(
    query: PersonalChordSheetSummaryQuery,
  ): Promise<PersonalChordSheetSummaryPage>;
}
