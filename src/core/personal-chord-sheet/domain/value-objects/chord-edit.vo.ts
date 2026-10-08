import { randomUUID } from "crypto";

import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { ValueObject } from "../../../shared/domain/value-object";

export type ChordEditType =
  | "replace_chord"
  | "insert_chord"
  | "delete_chord"
  | "shift_chord"
  | "relabel_section"
  | "annotate";

/**
 * A mesma lista em runtime, para o DTO validar sem repetir os literais.
 * Espelha PERSONAL_CHORD_SHEET_SHARE_SCOPES no agregado.
 */
export const CHORD_EDIT_TYPES: readonly ChordEditType[] = [
  "replace_chord",
  "insert_chord",
  "delete_chord",
  "shift_chord",
  "relabel_section",
  "annotate",
];

export type ChordEditProps = {
  edit_id: string;
  type: ChordEditType;
  /** Âncora temporal. Em relabel_section representa o início da seção. */
  at_ms: number;
  /** Destino do shift_chord. */
  to_ms?: number | null;
  /** Símbolo esperado no base — usado para confirmar que a âncora é a certa. */
  from?: string | null;
  /** Símbolo novo do replace_chord. */
  to?: string | null;
  /** Símbolo do insert_chord / shift_chord. */
  symbol?: string | null;
  /** Rótulo do relabel_section ("Refrão", "Solo"). */
  label?: string | null;
  /** Texto livre do annotate ("aqui entra o solo"). */
  text?: string | null;
  created_at: Date;
};

/** Forma serializada de um ChordEdit — todos os campos presentes. */
export type ChordEditJSON = {
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

/** Ordem de aplicação quando dois edits caem no mesmo instante. Ver ordering rank. */
const TYPE_RANK: Record<ChordEditType, number> = {
  delete_chord: 0,
  replace_chord: 1,
  relabel_section: 2,
  annotate: 3,
  shift_chord: 4,
  insert_chord: 5,
};

export const MAX_ANNOTATION_LENGTH = 500;
export const MAX_SECTION_LABEL_LENGTH = 60;
export const MAX_CHORD_SYMBOL_LENGTH = 24;

/**
 * Uma edição pontual do músico sobre a cifra gerada pela IA.
 *
 * A escolha central do Bloco 8: edits são ancorados por **tempo + símbolo
 * esperado**, nunca por índice no array de acordes. Índice quebra assim que o
 * modelo é retreinado e o timeline muda de tamanho; tempo+símbolo sobrevive,
 * e quando não sobrevive vira um conflito explícito que o músico revisa —
 * em vez de uma cifra silenciosamente errada.
 */
export class ChordEdit extends ValueObject {
  readonly edit_id: string;
  readonly type: ChordEditType;
  readonly at_ms: number;
  readonly to_ms: number | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly symbol: string | null;
  readonly label: string | null;
  readonly text: string | null;
  readonly created_at: Date;

  constructor(props: ChordEditProps) {
    super();
    this.edit_id = props.edit_id;
    this.type = props.type;
    this.at_ms = props.at_ms;
    this.to_ms = props.to_ms ?? null;
    this.from = props.from ?? null;
    this.to = props.to ?? null;
    this.symbol = props.symbol ?? null;
    this.label = props.label ?? null;
    this.text = props.text ?? null;
    this.created_at = props.created_at;
  }

  // ─── Factories ─────────────────────────────────────────────────────────────

  static replaceChord(props: {
    at_ms: number;
    from: string;
    to: string;
  }): ChordEdit {
    assertTimestamp(props.at_ms, "at_ms");
    assertChordSymbol(props.from, "from");
    assertChordSymbol(props.to, "to");

    return new ChordEdit({
      edit_id: randomUUID(),
      type: "replace_chord",
      at_ms: Math.round(props.at_ms),
      from: props.from.trim(),
      to: props.to.trim(),
      created_at: new Date(),
    });
  }

  static insertChord(props: { at_ms: number; symbol: string }): ChordEdit {
    assertTimestamp(props.at_ms, "at_ms");
    assertChordSymbol(props.symbol, "symbol");

    return new ChordEdit({
      edit_id: randomUUID(),
      type: "insert_chord",
      at_ms: Math.round(props.at_ms),
      symbol: props.symbol.trim(),
      created_at: new Date(),
    });
  }

  static deleteChord(props: { at_ms: number; from: string }): ChordEdit {
    assertTimestamp(props.at_ms, "at_ms");
    assertChordSymbol(props.from, "from");

    return new ChordEdit({
      edit_id: randomUUID(),
      type: "delete_chord",
      at_ms: Math.round(props.at_ms),
      from: props.from.trim(),
      created_at: new Date(),
    });
  }

  static shiftChord(props: {
    at_ms: number;
    to_ms: number;
    symbol: string;
  }): ChordEdit {
    assertTimestamp(props.at_ms, "at_ms");
    assertTimestamp(props.to_ms, "to_ms");
    assertChordSymbol(props.symbol, "symbol");

    return new ChordEdit({
      edit_id: randomUUID(),
      type: "shift_chord",
      at_ms: Math.round(props.at_ms),
      to_ms: Math.round(props.to_ms),
      symbol: props.symbol.trim(),
      created_at: new Date(),
    });
  }

  static relabelSection(props: {
    section_start_ms: number;
    label: string;
  }): ChordEdit {
    assertTimestamp(props.section_start_ms, "section_start_ms");
    assertText(props.label, "label", MAX_SECTION_LABEL_LENGTH);

    return new ChordEdit({
      edit_id: randomUUID(),
      type: "relabel_section",
      at_ms: Math.round(props.section_start_ms),
      label: props.label.trim(),
      created_at: new Date(),
    });
  }

  static annotate(props: { at_ms: number; text: string }): ChordEdit {
    assertTimestamp(props.at_ms, "at_ms");
    assertText(props.text, "text", MAX_ANNOTATION_LENGTH);

    return new ChordEdit({
      edit_id: randomUUID(),
      type: "annotate",
      at_ms: Math.round(props.at_ms),
      text: props.text.trim(),
      created_at: new Date(),
    });
  }

  // ─── Serialização ──────────────────────────────────────────────────────────

  /**
   * Leitura tolerante do Json persistido. Devolve null em vez de lançar: um edit
   * corrompido ou de um formato antigo não pode impedir o músico de abrir a
   * cifra inteira no meio de um show.
   */
  static fromJSON(raw: unknown): ChordEdit | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;

    const type = record.type;
    if (typeof type !== "string" || !(type in TYPE_RANK)) return null;

    const at_ms = toFiniteNumber(record.at_ms);
    if (at_ms === null) return null;

    const edit_id =
      typeof record.edit_id === "string" && record.edit_id.trim()
        ? record.edit_id
        : randomUUID();

    const created_at = toDate(record.created_at);

    return new ChordEdit({
      edit_id,
      type: type as ChordEditType,
      // Arredonda igual às factories: um at_ms fracionário escapado para o banco
      // produziria uma âncora fora da grade de milissegundos do timeline.
      at_ms: Math.round(at_ms),
      to_ms: roundOrNull(toFiniteNumber(record.to_ms)),
      from: toNullableString(record.from),
      to: toNullableString(record.to),
      symbol: toNullableString(record.symbol),
      label: toNullableString(record.label),
      text: toNullableString(record.text),
      created_at,
    });
  }

  /** Ordem determinística de aplicação — ver ChordSheetOverlayApplier. */
  get orderingRank(): number {
    return TYPE_RANK[this.type];
  }

  /** Símbolo que o edit espera encontrar no base, quando aplicável. */
  get expectedSymbol(): string | null {
    return this.from;
  }

  /**
   * Todos os campos são sempre emitidos (null quando não se aplicam ao tipo),
   * então o retorno é explícito em vez de derivado de ChordEditProps — lá os
   * campos são opcionais porque as factories só preenchem os que interessam.
   */
  toJSON(): ChordEditJSON {
    return {
      edit_id: this.edit_id,
      type: this.type,
      at_ms: this.at_ms,
      to_ms: this.to_ms,
      from: this.from,
      to: this.to,
      symbol: this.symbol,
      label: this.label,
      text: this.text,
      created_at: this.created_at.toISOString(),
    };
  }
}

// ─── Validações (privadas ao módulo) ─────────────────────────────────────────

function assertTimestamp(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new EntityValidationError([
      { [field]: [`${field} deve ser um número finito de milissegundos.`] },
    ]);
  }
  if (value < 0) {
    throw new EntityValidationError([
      { [field]: [`${field} não pode ser negativo.`] },
    ]);
  }
}

function assertChordSymbol(value: string, field: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new EntityValidationError([{ [field]: [`${field} é obrigatório.`] }]);
  }
  if (value.trim().length > MAX_CHORD_SYMBOL_LENGTH) {
    throw new EntityValidationError([
      {
        [field]: [
          `${field} não pode ter mais de ${MAX_CHORD_SYMBOL_LENGTH} caracteres.`,
        ],
      },
    ]);
  }
}

function assertText(value: string, field: string, max: number): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new EntityValidationError([{ [field]: [`${field} é obrigatório.`] }]);
  }
  if (value.trim().length > max) {
    throw new EntityValidationError([
      { [field]: [`${field} não pode ter mais de ${max} caracteres.`] },
    ]);
  }
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}
