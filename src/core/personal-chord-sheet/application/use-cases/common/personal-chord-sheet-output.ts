import {
  PersonalChordSheet,
  type PersonalChordSheetReconcileStatus,
  type PersonalChordSheetShareScope,
} from "../../../domain/personal-chord-sheet.aggregate";
import type { ChordEditType } from "../../../domain/value-objects/chord-edit.vo";
import type { ChordSheetViewSettingsProps } from "../../../domain/value-objects/chord-sheet-view-settings.vo";
import type { PersonalChordSheetSummaryReadModel } from "../../gateways/personal-chord-sheet-read-model.interface";

export type ChordEditOutput = {
  edit_id: string;
  type: ChordEditType;
  at_ms: number;
  to_ms: number | null;
  from: string | null;
  to: string | null;
  symbol: string | null;
  label: string | null;
  text: string | null;
  created_at: string;
};

export type ChordSheetViewSettingsOutput =
  Required<ChordSheetViewSettingsProps>;

export type PersonalChordSheetOutput = {
  personal_chord_sheet_id: string;
  music_library_id: string;
  musician_id: string;
  base_version: number;
  base_fingerprint: string;
  base_pipeline_version: number;
  edits: ChordEditOutput[];
  edit_count: number;
  view: ChordSheetViewSettingsOutput;
  /** null quando quem lê não é o dono — anotação pessoal não é da comunidade. */
  notes: string | null;
  share_scope: PersonalChordSheetShareScope;
  is_shared: boolean;
  shared_at: Date | null;
  reconcile_status: PersonalChordSheetReconcileStatus;
  created_at: Date;
  updated_at: Date;
};

/**
 * A linha de listagem: tudo do fork MENOS o array de edits, mais `edit_count`.
 *
 * Existe porque a listagem não usa os edits para nada e eles são o campo caro
 * (até 500 por fork). Quem quer as correções pede o fork individual ou a rota
 * /chord-sheet, que é onde elas de fato importam.
 */
export type PersonalChordSheetSummaryOutput = Omit<
  PersonalChordSheetOutput,
  "edits"
>;

export class PersonalChordSheetOutputMapper {
  /**
   * `isOwner=false` esconde as anotações privadas do músico, no mesmo espírito
   * de RepertoireOutputMapper (que esconde share_token e invitees de terceiros).
   * O que a comunidade vê são as correções de acorde, não o caderno pessoal.
   *
   * ⚠️ `isOwner` é OBRIGATÓRIO de propósito — não tem default. Um default `true`
   * faz o esquecimento numa rota de comunidade vazar `notes` no JSON; sem
   * default, o mesmo esquecimento vira erro de compilação. Fail-closed em tempo
   * de build vence fail-open em runtime.
   */
  static toOutput(
    entity: PersonalChordSheet,
    isOwner: boolean,
  ): PersonalChordSheetOutput {
    return {
      personal_chord_sheet_id: entity.personal_chord_sheet_id.id,
      music_library_id: entity.music_library_id,
      musician_id: entity.musician_id,
      base_version: entity.base_version,
      base_fingerprint: entity.base_fingerprint,
      base_pipeline_version: entity.base_pipeline_version,
      edits: entity.edits.map((edit) => edit.toJSON()),
      edit_count: entity.edits.length,
      view: entity.view.toJSON(),
      notes: isOwner ? entity.notes : null,
      share_scope: entity.share_scope,
      is_shared: entity.is_shared,
      shared_at: entity.shared_at,
      reconcile_status: entity.reconcile_status,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  /**
   * Projeção do read-model → resposta. `isOwner` obrigatório pelo mesmo motivo
   * do toOutput: é ele que decide se `notes` sai no JSON.
   */
  static toSummaryOutput(
    row: PersonalChordSheetSummaryReadModel,
    isOwner: boolean,
  ): PersonalChordSheetSummaryOutput {
    return {
      personal_chord_sheet_id: row.personal_chord_sheet_id,
      music_library_id: row.music_library_id,
      musician_id: row.musician_id,
      base_version: row.base_version,
      base_fingerprint: row.base_fingerprint,
      base_pipeline_version: row.base_pipeline_version,
      edit_count: row.edit_count,
      view: row.view,
      notes: isOwner ? row.notes : null,
      share_scope: row.share_scope,
      is_shared: row.share_scope !== "private",
      shared_at: row.shared_at,
      reconcile_status: row.reconcile_status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
