import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  PERSONAL_CHORD_SHEET_SHARE_SCOPES,
  PersonalChordSheet,
  PersonalChordSheetId,
  type PersonalChordSheetReconcileStatus,
  type PersonalChordSheetShareScope,
} from "../../../domain/personal-chord-sheet.aggregate";
import { ChordEdit } from "../../../domain/value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "../../../domain/value-objects/chord-sheet-view-settings.vo";
import { PersonalChordSheetModel } from "./personal-chord-sheet-model";

export class PersonalChordSheetModelMapper {
  static toModel(entity: PersonalChordSheet): Omit<
    PersonalChordSheetModel,
    "edits" | "view"
  > & {
    edits: unknown;
    view: unknown;
  } {
    return {
      id: entity.personal_chord_sheet_id.id,
      musician_id: entity.musician_id,
      music_library_id: entity.music_library_id,
      base_version: entity.base_version,
      base_fingerprint: entity.base_fingerprint,
      base_pipeline_version: entity.base_pipeline_version,
      edits: entity.edits.map((edit) => edit.toJSON()),
      view: entity.view.toJSON(),
      notes: entity.notes,
      share_scope: entity.share_scope,
      shared_at: entity.shared_at,
      reconcile_status: entity.reconcile_status,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: PersonalChordSheetModel): PersonalChordSheet {
    if (!model?.id) {
      throw new LoadEntityError([
        { id: ["Cifra pessoal sem identificador no banco."] },
      ]);
    }

    return new PersonalChordSheet({
      personal_chord_sheet_id: new PersonalChordSheetId(model.id),
      musician_id: model.musician_id,
      music_library_id: model.music_library_id,
      base_version: model.base_version,
      base_fingerprint: model.base_fingerprint,
      base_pipeline_version: model.base_pipeline_version,
      edits: coerceEdits(model.edits),
      view: ChordSheetViewSettings.fromJSON(model.view),
      notes: model.notes,
      share_scope: coerceShareScope(model.share_scope),
      shared_at: model.shared_at,
      reconcile_status: coerceReconcileStatus(model.reconcile_status),
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}

/**
 * Leitura deliberadamente tolerante: um edit corrompido ou de formato antigo é
 * DESCARTADO, nunca derruba a carga da cifra inteira. O músico perder uma
 * correção é ruim; ele não conseguir abrir a cifra no meio do show é pior.
 */
function coerceEdits(raw: unknown): ChordEdit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ChordEdit.fromJSON(item))
    .filter((edit): edit is ChordEdit => edit !== null);
}

function coerceShareScope(raw: unknown): PersonalChordSheetShareScope {
  return PERSONAL_CHORD_SHEET_SHARE_SCOPES.includes(
    raw as PersonalChordSheetShareScope,
  )
    ? (raw as PersonalChordSheetShareScope)
    : "private"; // desconhecido → o mais restritivo, nunca vaza
}

function coerceReconcileStatus(
  raw: unknown,
): PersonalChordSheetReconcileStatus {
  return raw === "base_updated" ? "base_updated" : "clean";
}
