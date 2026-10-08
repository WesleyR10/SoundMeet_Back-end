import { randomUUID } from "crypto";

import {
  PersonalChordSheet,
  PersonalChordSheetId,
  type PersonalChordSheetReconcileStatus,
  type PersonalChordSheetShareScope,
} from "./personal-chord-sheet.aggregate";
import { ChordEdit } from "./value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "./value-objects/chord-sheet-view-settings.vo";

/** sha256 válido para os testes que não se importam com o valor exato. */
const FAKE_FINGERPRINT = "a".repeat(64);

export class PersonalChordSheetFakeBuilder {
  private _personal_chord_sheet_id: PersonalChordSheetId =
    new PersonalChordSheetId();
  private _music_library_id: string = randomUUID();
  private _musician_id: string = randomUUID();
  private _base_version: number = 0;
  private _base_fingerprint: string = FAKE_FINGERPRINT;
  private _base_pipeline_version: number = 1;
  private _edits: ChordEdit[] = [];
  private _view: ChordSheetViewSettings = ChordSheetViewSettings.default();
  private _notes: string | null = null;
  private _share_scope: PersonalChordSheetShareScope = "private";
  private _shared_at: Date | null = null;
  private _reconcile_status: PersonalChordSheetReconcileStatus = "clean";
  private _created_at: Date = new Date();
  private _updated_at: Date = new Date();

  static aPersonalChordSheet(): PersonalChordSheetFakeBuilder {
    return new PersonalChordSheetFakeBuilder();
  }

  static thePersonalChordSheets(
    count: number,
  ): PersonalChordSheetFakeBuilder[] {
    return Array.from(
      { length: count },
      () => new PersonalChordSheetFakeBuilder(),
    );
  }

  withPersonalChordSheetId(id: string | PersonalChordSheetId): this {
    this._personal_chord_sheet_id =
      typeof id === "string" ? new PersonalChordSheetId(id) : id;
    return this;
  }

  withMusicLibraryId(id: string): this {
    this._music_library_id = id;
    return this;
  }

  withMusicianId(id: string): this {
    this._musician_id = id;
    return this;
  }

  withBaseVersion(version: number): this {
    this._base_version = version;
    return this;
  }

  withBaseFingerprint(fingerprint: string): this {
    this._base_fingerprint = fingerprint;
    return this;
  }

  withBasePipelineVersion(version: number): this {
    this._base_pipeline_version = version;
    return this;
  }

  withEdits(edits: ChordEdit[]): this {
    this._edits = edits;
    return this;
  }

  /** Um replace_chord pronto, para testes que só precisam de "tem edição". */
  withOneEdit(): this {
    this._edits = [
      ChordEdit.replaceChord({ at_ms: 1000, from: "Am", to: "Am7" }),
    ];
    return this;
  }

  withView(view: ChordSheetViewSettings): this {
    this._view = view;
    return this;
  }

  withNotes(notes: string | null): this {
    this._notes = notes;
    return this;
  }

  withShareScope(scope: PersonalChordSheetShareScope): this {
    this._share_scope = scope;
    this._shared_at = scope === "private" ? null : new Date();
    return this;
  }

  withSharedAt(date: Date | null): this {
    this._shared_at = date;
    return this;
  }

  withReconcileStatus(status: PersonalChordSheetReconcileStatus): this {
    this._reconcile_status = status;
    return this;
  }

  withCreatedAt(date: Date): this {
    this._created_at = date;
    return this;
  }

  withUpdatedAt(date: Date): this {
    this._updated_at = date;
    return this;
  }

  // ─── Cenários inválidos (para testes de validação) ─────────────────────────

  withInvalidMusicianIdEmpty(): this {
    this._musician_id = "";
    return this;
  }

  withInvalidMusicLibraryIdEmpty(): this {
    this._music_library_id = "";
    return this;
  }

  withInvalidFingerprint(): this {
    this._base_fingerprint = "não é um sha256";
    return this;
  }

  withInvalidNotesTooLong(): this {
    this._notes = "a".repeat(5001);
    return this;
  }

  build(): PersonalChordSheet {
    return new PersonalChordSheet({
      personal_chord_sheet_id: this._personal_chord_sheet_id,
      music_library_id: this._music_library_id,
      musician_id: this._musician_id,
      base_version: this._base_version,
      base_fingerprint: this._base_fingerprint,
      base_pipeline_version: this._base_pipeline_version,
      edits: this._edits,
      view: this._view,
      notes: this._notes,
      share_scope: this._share_scope,
      shared_at: this._shared_at,
      reconcile_status: this._reconcile_status,
      created_at: this._created_at,
      updated_at: this._updated_at,
    });
  }
}
