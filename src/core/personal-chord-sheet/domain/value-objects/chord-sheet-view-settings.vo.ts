import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { ValueObject } from "../../../shared/domain/value-object";
import type { ChordComplexityLevel } from "../../../shared/domain/value-objects/chord-symbol.vo";

/**
 * "auto" resolve a grafia a partir da tonalidade da música — a decisão é do
 * ChordSheetOverlayApplier, não deste VO nem do ChordSymbol.
 */
export type PreferredAccidental = "sharp" | "flat" | "auto";

/**
 * Instrumento escolhido pelo músico. Não altera nenhum símbolo de acorde —
 * seleciona qual conjunto de digitações o solver de diagramas devolve.
 */
export type ChordSheetInstrument =
  | "guitar"
  | "guitar7"
  | "ukulele"
  | "cavaquinho"
  | "bass"
  | "keyboard";

export const CHORD_SHEET_INSTRUMENTS: readonly ChordSheetInstrument[] = [
  "guitar",
  "guitar7",
  "ukulele",
  "cavaquinho",
  "bass",
  "keyboard",
];

export const CHORD_COMPLEXITY_LEVELS: readonly ChordComplexityLevel[] = [
  "full",
  "simple",
  "basic",
];

export const PREFERRED_ACCIDENTALS: readonly PreferredAccidental[] = [
  "sharp",
  "flat",
  "auto",
];

export const MIN_TRANSPOSE_SEMITONES = -11;
export const MAX_TRANSPOSE_SEMITONES = 11;
export const MIN_CAPO_FRET = 0;
export const MAX_CAPO_FRET = 12;

export type ChordSheetViewSettingsProps = {
  transpose_semitones?: number;
  capo_fret?: number;
  chord_complexity?: ChordComplexityLevel;
  instrument?: ChordSheetInstrument;
  left_handed?: boolean;
  preferred_accidental?: PreferredAccidental;
  /** Velocidade da rolagem automática, 0.5x a 2x. */
  scroll_speed?: number;
};

export const MIN_SCROLL_SPEED = 0.5;
export const MAX_SCROLL_SPEED = 2;

/**
 * Como o músico QUER VER a cifra — nunca o conteúdo dela.
 *
 * Tom e capotraste são parâmetros de visualização, não dados persistidos no
 * acorde. Guardar a cifra já transposta impediria mostrar "tom original vs tom
 * que eu toco", quebraria o matching de edits e tornaria a reconciliação
 * impossível. Um único artefato serve todos os tons.
 */
export class ChordSheetViewSettings extends ValueObject {
  readonly transpose_semitones: number;
  readonly capo_fret: number;
  readonly chord_complexity: ChordComplexityLevel;
  readonly instrument: ChordSheetInstrument;
  readonly left_handed: boolean;
  readonly preferred_accidental: PreferredAccidental;
  readonly scroll_speed: number;

  private constructor(props: Required<ChordSheetViewSettingsProps>) {
    super();
    this.transpose_semitones = props.transpose_semitones;
    this.capo_fret = props.capo_fret;
    this.chord_complexity = props.chord_complexity;
    this.instrument = props.instrument;
    this.left_handed = props.left_handed;
    this.preferred_accidental = props.preferred_accidental;
    this.scroll_speed = props.scroll_speed;
  }

  static default(): ChordSheetViewSettings {
    return new ChordSheetViewSettings({
      transpose_semitones: 0,
      capo_fret: 0,
      chord_complexity: "full",
      instrument: "guitar",
      left_handed: false,
      preferred_accidental: "auto",
      scroll_speed: 1,
    });
  }

  static create(props: ChordSheetViewSettingsProps): ChordSheetViewSettings {
    const base = ChordSheetViewSettings.default();
    return base.with(props);
  }

  /**
   * Leitura tolerante do Json persistido: campo desconhecido ou corrompido cai
   * no default em vez de derrubar a cifra inteira.
   */
  static fromJSON(raw: unknown): ChordSheetViewSettings {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return ChordSheetViewSettings.default();
    }
    const record = raw as Record<string, unknown>;
    const fallback = ChordSheetViewSettings.default();

    return new ChordSheetViewSettings({
      transpose_semitones: clampInteger(
        record.transpose_semitones,
        MIN_TRANSPOSE_SEMITONES,
        MAX_TRANSPOSE_SEMITONES,
        fallback.transpose_semitones,
      ),
      capo_fret: clampInteger(
        record.capo_fret,
        MIN_CAPO_FRET,
        MAX_CAPO_FRET,
        fallback.capo_fret,
      ),
      chord_complexity: pickFrom(
        record.chord_complexity,
        CHORD_COMPLEXITY_LEVELS,
        fallback.chord_complexity,
      ),
      instrument: pickFrom(
        record.instrument,
        CHORD_SHEET_INSTRUMENTS,
        fallback.instrument,
      ),
      left_handed:
        typeof record.left_handed === "boolean"
          ? record.left_handed
          : fallback.left_handed,
      preferred_accidental: pickFrom(
        record.preferred_accidental,
        PREFERRED_ACCIDENTALS,
        fallback.preferred_accidental,
      ),
      scroll_speed: clampNumber(
        record.scroll_speed,
        MIN_SCROLL_SPEED,
        MAX_SCROLL_SPEED,
        fallback.scroll_speed,
      ),
    });
  }

  /** Aplica um patch parcial devolvendo uma nova instância — nunca muta. */
  with(patch: ChordSheetViewSettingsProps): ChordSheetViewSettings {
    const next: Required<ChordSheetViewSettingsProps> = {
      transpose_semitones:
        patch.transpose_semitones ?? this.transpose_semitones,
      capo_fret: patch.capo_fret ?? this.capo_fret,
      chord_complexity: patch.chord_complexity ?? this.chord_complexity,
      instrument: patch.instrument ?? this.instrument,
      left_handed: patch.left_handed ?? this.left_handed,
      preferred_accidental:
        patch.preferred_accidental ?? this.preferred_accidental,
      scroll_speed: patch.scroll_speed ?? this.scroll_speed,
    };

    validate(next);
    return new ChordSheetViewSettings(next);
  }

  /**
   * Semitons a aplicar nos símbolos exibidos. É o ÚNICO lugar do sistema onde
   * esta conta pode existir.
   *
   * O capotraste eleva a afinação das cordas soltas; para soar na mesma altura,
   * o músico toca as formas N semitons ABAIXO. Por isso o capo entra subtraindo:
   *   transpose=+2, capo=2 →  0  (soa 2 acima, formas iguais às originais)
   *   transpose=0,  capo=3 → −3  (mesma altura, formas 3 abaixo)
   */
  effectiveDisplaySemitones(): number {
    return this.transpose_semitones - this.capo_fret;
  }

  /** Curto-circuito: sem transposição nem simplificação, o base passa intacto. */
  isIdentity(): boolean {
    return (
      this.effectiveDisplaySemitones() === 0 && this.chord_complexity === "full"
    );
  }

  toJSON(): Required<ChordSheetViewSettingsProps> {
    return {
      transpose_semitones: this.transpose_semitones,
      capo_fret: this.capo_fret,
      chord_complexity: this.chord_complexity,
      instrument: this.instrument,
      left_handed: this.left_handed,
      preferred_accidental: this.preferred_accidental,
      scroll_speed: this.scroll_speed,
    };
  }
}

// ─── Helpers (privados ao módulo) ────────────────────────────────────────────

function validate(props: Required<ChordSheetViewSettingsProps>): void {
  assertIntegerInRange(
    props.transpose_semitones,
    "transpose_semitones",
    MIN_TRANSPOSE_SEMITONES,
    MAX_TRANSPOSE_SEMITONES,
  );
  assertIntegerInRange(
    props.capo_fret,
    "capo_fret",
    MIN_CAPO_FRET,
    MAX_CAPO_FRET,
  );

  if (!CHORD_COMPLEXITY_LEVELS.includes(props.chord_complexity)) {
    throw new EntityValidationError([
      {
        chord_complexity: [
          `chord_complexity deve ser um de: ${CHORD_COMPLEXITY_LEVELS.join(", ")}.`,
        ],
      },
    ]);
  }

  if (!CHORD_SHEET_INSTRUMENTS.includes(props.instrument)) {
    throw new EntityValidationError([
      {
        instrument: [
          `instrument deve ser um de: ${CHORD_SHEET_INSTRUMENTS.join(", ")}.`,
        ],
      },
    ]);
  }

  if (!PREFERRED_ACCIDENTALS.includes(props.preferred_accidental)) {
    throw new EntityValidationError([
      {
        preferred_accidental: [
          `preferred_accidental deve ser um de: ${PREFERRED_ACCIDENTALS.join(", ")}.`,
        ],
      },
    ]);
  }

  if (typeof props.left_handed !== "boolean") {
    throw new EntityValidationError([
      { left_handed: ["left_handed deve ser booleano."] },
    ]);
  }

  if (
    typeof props.scroll_speed !== "number" ||
    !Number.isFinite(props.scroll_speed) ||
    props.scroll_speed < MIN_SCROLL_SPEED ||
    props.scroll_speed > MAX_SCROLL_SPEED
  ) {
    throw new EntityValidationError([
      {
        scroll_speed: [
          `scroll_speed deve estar entre ${MIN_SCROLL_SPEED} e ${MAX_SCROLL_SPEED}.`,
        ],
      },
    ]);
  }
}

function assertIntegerInRange(
  value: number,
  field: string,
  min: number,
  max: number,
): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new EntityValidationError([
      { [field]: [`${field} deve ser um número inteiro.`] },
    ]);
  }
  if (value < min || value > max) {
    throw new EntityValidationError([
      { [field]: [`${field} deve estar entre ${min} e ${max}.`] },
    ]);
  }
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Semitons e casa do capotraste são discretos. fromJSON não passa por validate(),
 * então um valor fracionário persistido escaparia para o applier e produziria
 * transposição fora da grade cromática.
 */
function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pickFrom<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
