import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { PersonalChordSheetValidatorFactory } from "./personal-chord-sheet.validator";
import { PersonalChordSheetFakeBuilder } from "./personal-chord-sheet-fake.builder";
import { ChordEdit } from "./value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "./value-objects/chord-sheet-view-settings.vo";

export class PersonalChordSheetId extends Uuid {}

/**
 * Alcance do compartilhamento.
 * - `private`   — só o dono (padrão).
 * - `band`      — os membros das bandas do dono. Só o SoundMeet sabe quem é a
 *                 banda de alguém; é o compartilhamento que nenhum concorrente
 *                 consegue oferecer.
 * - `community` — qualquer músico da plataforma, somente leitura.
 */
export type PersonalChordSheetShareScope = "private" | "band" | "community";

export const PERSONAL_CHORD_SHEET_SHARE_SCOPES: readonly PersonalChordSheetShareScope[] =
  ["private", "band", "community"];

/**
 * `clean`        — os edits estão ancorados na mesma análise em que foram feitos.
 * `base_updated` — a IA re-analisou a música; há reconciliação pendente.
 */
export type PersonalChordSheetReconcileStatus = "clean" | "base_updated";

export const MAX_EDITS_PER_SHEET = 500;
export const MAX_NOTES_LENGTH = 5000;

export type PersonalChordSheetConstructorProps = {
  personal_chord_sheet_id?: PersonalChordSheetId;
  music_library_id: string;
  musician_id: string;
  base_version?: number;
  base_fingerprint: string;
  base_pipeline_version?: number;
  edits?: ChordEdit[];
  view?: ChordSheetViewSettings;
  notes?: string | null;
  share_scope?: PersonalChordSheetShareScope;
  shared_at?: Date | null;
  reconcile_status?: PersonalChordSheetReconcileStatus;
  created_at?: Date;
  updated_at?: Date;
};

export type PersonalChordSheetCreateCommand = {
  music_library_id: string;
  musician_id: string;
  base_version?: number;
  base_fingerprint: string;
  base_pipeline_version: number;
};

/**
 * A versão pessoal que o músico tem de uma cifra gerada pela IA.
 *
 * Guarda **o que ele mudou**, não uma cópia da cifra. A original
 * (`music_library.chord_sheet`) permanece imutável e continua sendo servida a
 * todo mundo; este agregado é a camada por cima. Quando o modelo é retreinado e
 * a música é re-analisada, as correções são reaplicadas sobre a análise nova em
 * vez de congelarem numa cifra velha — ver ChordSheetOverlayApplier.
 */
export class PersonalChordSheet extends AggregateRoot {
  personal_chord_sheet_id: PersonalChordSheetId;
  music_library_id: string;
  musician_id: string;

  /**
   * Cópia de `music_library.chord_sheet_version` no momento do fork.
   *
   * ADVISORY, nunca fonte de decisão: `MusicLibrary.updateChords()` não
   * incrementa essa coluna — só `updateChordSheet()` incrementa, e essa é a
   * materialização do blob, não a análise. Uma re-análise da IA passa por ela
   * sem alterá-la. Quem detecta mudança real é `base_fingerprint`.
   */
  base_version: number;

  /** sha256 do timeline normalizado — o sinal real de "a IA re-analisou". */
  base_fingerprint: string;

  /**
   * `CHORD_SHEET_FINGERPRINT_VERSION` vigente no fork. Separa "a fonte mudou"
   * de "nosso normalizador mudou": só o primeiro caso merece avisar o músico.
   */
  base_pipeline_version: number;

  edits: ChordEdit[];
  view: ChordSheetViewSettings;
  notes: string | null;
  share_scope: PersonalChordSheetShareScope;
  shared_at: Date | null;
  reconcile_status: PersonalChordSheetReconcileStatus;
  created_at: Date;
  updated_at: Date;

  constructor(props: PersonalChordSheetConstructorProps) {
    super();
    this.personal_chord_sheet_id =
      props.personal_chord_sheet_id ?? new PersonalChordSheetId();
    this.music_library_id = props.music_library_id;
    this.musician_id = props.musician_id;
    this.base_version = props.base_version ?? 0;
    this.base_fingerprint = props.base_fingerprint;
    this.base_pipeline_version = props.base_pipeline_version ?? 1;
    this.edits = props.edits ? [...props.edits] : [];
    this.view = props.view ?? ChordSheetViewSettings.default();
    this.notes = props.notes ?? null;
    this.share_scope = props.share_scope ?? "private";
    this.shared_at = props.shared_at ?? null;
    this.reconcile_status = props.reconcile_status ?? "clean";
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): PersonalChordSheetId {
    return this.personal_chord_sheet_id;
  }

  static create(command: PersonalChordSheetCreateCommand): PersonalChordSheet {
    const sheet = new PersonalChordSheet({
      music_library_id: command.music_library_id,
      musician_id: command.musician_id,
      base_version: command.base_version ?? 0,
      base_fingerprint: command.base_fingerprint,
      base_pipeline_version: command.base_pipeline_version,
    });
    sheet.validate();
    if (sheet.notification.hasErrors()) {
      throw new EntityValidationError(sheet.notification.toJSON());
    }
    return sheet;
  }

  // ─── Edições ───────────────────────────────────────────────────────────────

  addEdit(edit: ChordEdit): void {
    if (this.edits.length >= MAX_EDITS_PER_SHEET) {
      throw new EntityValidationError([
        {
          edits: [
            `Uma cifra pessoal não pode ter mais de ${MAX_EDITS_PER_SHEET} edições.`,
          ],
        },
      ]);
    }
    this.edits.push(edit);
    this.touch();
  }

  addEdits(edits: ChordEdit[]): void {
    if (this.edits.length + edits.length > MAX_EDITS_PER_SHEET) {
      throw new EntityValidationError([
        {
          edits: [
            `Uma cifra pessoal não pode ter mais de ${MAX_EDITS_PER_SHEET} edições.`,
          ],
        },
      ]);
    }
    this.edits.push(...edits);
    this.touch();
  }

  removeEdit(edit_id: string): void {
    const index = this.edits.findIndex((e) => e.edit_id === edit_id);
    if (index === -1) {
      throw new EntityValidationError([
        { edit_id: ["Edição não encontrada nesta cifra pessoal."] },
      ]);
    }
    this.edits.splice(index, 1);
    this.touch();
  }

  replaceEdits(edits: ChordEdit[]): void {
    if (edits.length > MAX_EDITS_PER_SHEET) {
      throw new EntityValidationError([
        {
          edits: [
            `Uma cifra pessoal não pode ter mais de ${MAX_EDITS_PER_SHEET} edições.`,
          ],
        },
      ]);
    }
    this.edits = [...edits];
    this.touch();
  }

  clearEdits(): void {
    this.edits = [];
    this.touch();
  }

  // ─── Visualização e anotações ──────────────────────────────────────────────

  changeView(view: ChordSheetViewSettings): void {
    this.view = view;
    this.touch();
  }

  changeNotes(notes: string | null): void {
    const value = notes?.trim() ?? null;
    if (value !== null && value.length > MAX_NOTES_LENGTH) {
      throw new EntityValidationError([
        {
          notes: [
            `As anotações não podem ter mais de ${MAX_NOTES_LENGTH} caracteres.`,
          ],
        },
      ]);
    }
    this.notes = value === "" ? null : value;
    this.touch();
  }

  // ─── Compartilhamento ──────────────────────────────────────────────────────

  share(scope: Exclude<PersonalChordSheetShareScope, "private">): void {
    if (scope !== "band" && scope !== "community") {
      throw new EntityValidationError([
        { share_scope: ['O alcance deve ser "band" ou "community".'] },
      ]);
    }
    this.share_scope = scope;
    this.shared_at = new Date();
    this.touch();
  }

  unshare(): void {
    this.share_scope = "private";
    this.shared_at = null;
    this.touch();
  }

  get is_shared(): boolean {
    return this.share_scope !== "private";
  }

  // ─── Reconciliação ─────────────────────────────────────────────────────────

  /** true quando o fork ainda está ancorado na análise em que foi criado. */
  matchesBase(fingerprint: string, pipeline_version: number): boolean {
    return (
      this.base_fingerprint === fingerprint &&
      this.base_pipeline_version === pipeline_version
    );
  }

  markBaseUpdated(): void {
    if (this.reconcile_status === "base_updated") return;
    this.reconcile_status = "base_updated";
    this.touch();
  }

  /**
   * Reancora o fork na análise nova. Recebe os edits que sobreviveram à
   * reaplicação — os conflitantes já foram resolvidos (mantidos ou descartados)
   * pelo use-case de reconciliação.
   */
  markReconciled(props: {
    kept_edits: ChordEdit[];
    base_fingerprint: string;
    base_version?: number;
    base_pipeline_version: number;
  }): void {
    this.edits = [...props.kept_edits];
    this.base_fingerprint = props.base_fingerprint;
    this.base_version = props.base_version ?? this.base_version;
    this.base_pipeline_version = props.base_pipeline_version;
    this.reconcile_status = "clean";
    this.touch();
  }

  // ─── Infra do agregado ─────────────────────────────────────────────────────

  validate(fields?: string[]): boolean {
    const validator = PersonalChordSheetValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return PersonalChordSheetFakeBuilder;
  }

  private touch(): void {
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      personal_chord_sheet_id: this.personal_chord_sheet_id.id,
      music_library_id: this.music_library_id,
      musician_id: this.musician_id,
      base_version: this.base_version,
      base_fingerprint: this.base_fingerprint,
      base_pipeline_version: this.base_pipeline_version,
      edits: this.edits.map((e) => e.toJSON()),
      view: this.view.toJSON(),
      notes: this.notes,
      share_scope: this.share_scope,
      is_shared: this.is_shared,
      shared_at: this.shared_at,
      reconcile_status: this.reconcile_status,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
