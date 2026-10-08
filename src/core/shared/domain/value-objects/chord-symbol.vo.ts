import { ValueObject } from "../value-object";

/**
 * Preferência de grafia enarmônica. "C#" e "Db" são a mesma altura (pitch class 1);
 * qual das duas escrever depende da tonalidade, e essa decisão NÃO é tomada aqui —
 * este VO não conhece teoria de tonalidade de propósito (ver ChordSheetOverlayApplier,
 * que resolve "auto" a partir de meta.key antes de chamar transpose()).
 */
export type ChordAccidentalPreference = "sharp" | "flat";

/** Níveis de simplificação expostos ao músico ("acordes simplificados"). */
export type ChordComplexityLevel = "full" | "simple" | "basic";

/** Tríade base do acorde. "five" é o power chord (C5). */
export type ChordTriad =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "five";

/**
 * Sétima do acorde.
 * - "dom7"  = sétima menor (C7, Am7). Sobre tríade dim vira meio-diminuto: m7(b5).
 * - "maj7"  = sétima maior (C7M/Cmaj7). Sobre tríade menor vira m(7M).
 * - "dim7"  = sétima diminuta (Cdim7).
 */
export type ChordSeventh = "dom7" | "maj7" | "dim7";

/** Extensão superior. Em notação de cifra implica as inferiores (13 ⊃ 11 ⊃ 9). */
export type ChordExtension = "9" | "11" | "13";

export type ChordSymbolProps = {
  root_pc: number;
  root_spelling: string;
  triad: ChordTriad;
  seventh: ChordSeventh | null;
  extension: ChordExtension | null;
  /** Alterações entre parênteses, já normalizadas: "b5", "#5", "b9", "#9", "#11", "b13". */
  alterations: string[];
  /** Notas acrescentadas sem sétima implícita: "6", "add9", "add11". */
  added: string[];
  bass_pc: number | null;
  bass_spelling: string | null;
};

const SHARP_SPELLING = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const FLAT_SPELLING = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

const NATURAL_PITCH_CLASS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Símbolos que o worker MIR emite para "sem acorde" / silêncio. */
const NO_CHORD_TOKENS = new Set([
  "N",
  "NC",
  "N.C.",
  "NOCHORD",
  "NO_CHORD",
  "X",
]);

/**
 * Qualidades do formato colon emitido pelo worker MIR / ChordFormer
 * (ex.: "C:maj", "A:min7", "F#:min/C#"). Espelha mapColonQualityToSuffix
 * do get-chord-sheet-for-music-library.use-case.ts, ampliado.
 */
const COLON_QUALITY: Record<
  string,
  Pick<ChordSymbolProps, "triad" | "seventh"> & {
    extension?: ChordExtension | null;
    alterations?: string[];
    added?: string[];
  }
> = {
  maj: { triad: "maj", seventh: null },
  major: { triad: "maj", seventh: null },
  min: { triad: "min", seventh: null },
  minor: { triad: "min", seventh: null },
  dim: { triad: "dim", seventh: null },
  aug: { triad: "aug", seventh: null },
  sus2: { triad: "sus2", seventh: null },
  sus4: { triad: "sus4", seventh: null },
  sus: { triad: "sus4", seventh: null },
  "5": { triad: "five", seventh: null },
  "7": { triad: "maj", seventh: "dom7" },
  maj7: { triad: "maj", seventh: "maj7" },
  major7: { triad: "maj", seventh: "maj7" },
  min7: { triad: "min", seventh: "dom7" },
  minor7: { triad: "min", seventh: "dom7" },
  m7: { triad: "min", seventh: "dom7" },
  dim7: { triad: "dim", seventh: "dim7" },
  hdim7: { triad: "dim", seventh: "dom7" },
  minmaj7: { triad: "min", seventh: "maj7" },
  maj6: { triad: "maj", seventh: null, added: ["6"] },
  min6: { triad: "min", seventh: null, added: ["6"] },
  "6": { triad: "maj", seventh: null, added: ["6"] },
  "9": { triad: "maj", seventh: "dom7", extension: "9" },
  maj9: { triad: "maj", seventh: "maj7", extension: "9" },
  min9: { triad: "min", seventh: "dom7", extension: "9" },
  "11": { triad: "maj", seventh: "dom7", extension: "11" },
  min11: { triad: "min", seventh: "dom7", extension: "11" },
  "13": { triad: "maj", seventh: "dom7", extension: "13" },
  maj13: { triad: "maj", seventh: "maj7", extension: "13" },
  min13: { triad: "min", seventh: "dom7", extension: "13" },
};

/**
 * Sufixos da notação padrão/brasileira. A ordem importa: o parser casa o
 * sufixo mais longo primeiro, senão "m7" seria lido como "m" com sobra "7".
 * Inclui a notação brasileira do Cifra Club: 7M (sétima maior), 5+ (aug), 5- (b5).
 */
const SUFFIX_TABLE: Array<
  [
    string,
    Pick<ChordSymbolProps, "triad" | "seventh"> & {
      extension?: ChordExtension | null;
      alterations?: string[];
      added?: string[];
    },
  ]
> = [
  ["m(maj7)", { triad: "min", seventh: "maj7" }],
  ["m(7m)", { triad: "min", seventh: "maj7" }],
  ["mmaj7", { triad: "min", seventh: "maj7" }],
  ["m7m", { triad: "min", seventh: "maj7" }],
  ["m7(b5)", { triad: "dim", seventh: "dom7" }],
  ["m7b5", { triad: "dim", seventh: "dom7" }],
  ["m7(5-)", { triad: "dim", seventh: "dom7" }],
  ["halfdim", { triad: "dim", seventh: "dom7" }],
  ["dim7", { triad: "dim", seventh: "dim7" }],
  ["º7", { triad: "dim", seventh: "dim7" }],
  ["°7", { triad: "dim", seventh: "dim7" }],
  ["o7", { triad: "dim", seventh: "dim7" }],
  ["dim", { triad: "dim", seventh: null }],
  ["º", { triad: "dim", seventh: null }],
  ["°", { triad: "dim", seventh: null }],
  ["ø", { triad: "dim", seventh: "dom7" }],
  ["aug", { triad: "aug", seventh: null }],
  ["5+", { triad: "aug", seventh: null }],
  ["+", { triad: "aug", seventh: null }],
  ["sus2", { triad: "sus2", seventh: null }],
  ["sus4", { triad: "sus4", seventh: null }],
  ["sus", { triad: "sus4", seventh: null }],
  ["maj13", { triad: "maj", seventh: "maj7", extension: "13" }],
  ["maj11", { triad: "maj", seventh: "maj7", extension: "11" }],
  ["maj9", { triad: "maj", seventh: "maj7", extension: "9" }],
  ["maj7", { triad: "maj", seventh: "maj7" }],
  // Notação brasileira (Cifra Club): o "M" maiúsculo depois do grau.
  ["13M", { triad: "maj", seventh: "maj7", extension: "13" }],
  ["11M", { triad: "maj", seventh: "maj7", extension: "11" }],
  ["9M", { triad: "maj", seventh: "maj7", extension: "9" }],
  ["7M", { triad: "maj", seventh: "maj7" }],
  ["M7", { triad: "maj", seventh: "maj7" }],
  ["m13", { triad: "min", seventh: "dom7", extension: "13" }],
  ["m11", { triad: "min", seventh: "dom7", extension: "11" }],
  ["m9", { triad: "min", seventh: "dom7", extension: "9" }],
  ["m7", { triad: "min", seventh: "dom7" }],
  ["m6", { triad: "min", seventh: null, added: ["6"] }],
  ["m", { triad: "min", seventh: null }],
  ["-", { triad: "min", seventh: null }],
  ["add9", { triad: "maj", seventh: null, added: ["add9"] }],
  ["add11", { triad: "maj", seventh: null, added: ["add11"] }],
  ["13", { triad: "maj", seventh: "dom7", extension: "13" }],
  ["11", { triad: "maj", seventh: "dom7", extension: "11" }],
  ["9", { triad: "maj", seventh: "dom7", extension: "9" }],
  ["7", { triad: "maj", seventh: "dom7" }],
  ["6", { triad: "maj", seventh: null, added: ["6"] }],
  ["5", { triad: "five", seventh: null }],
  ["maj", { triad: "maj", seventh: null }],
  ["M", { triad: "maj", seventh: null }],
  // Formas por extenso. Existem principalmente porque meta.key pode chegar como
  // "C major" / "A minor": sem estas entradas a tonalidade não parseia, a
  // transposição a deixa verbatim e a grafia enarmônica cai no default —
  // degradação silenciosa, nunca um erro visível. A tabela colon do worker já
  // aceitava major/minor; esta ficou assimétrica até aqui.
  ["major", { triad: "maj", seventh: null }],
  ["min", { triad: "min", seventh: null }],
  ["minor", { triad: "min", seventh: null }],
  ["min7", { triad: "min", seventh: "dom7" }],
  ["", { triad: "maj", seventh: null }],
];

const ALTERATION_ALIASES: Record<string, string> = {
  b5: "b5",
  "5-": "b5",
  "#5": "#5",
  "5+": "#5",
  b9: "b9",
  "9-": "b9",
  "#9": "#9",
  "9+": "#9",
  "#11": "#11",
  "11+": "#11",
  b13: "b13",
  "13-": "b13",
};

const ALTERATION_ORDER = ["b5", "#5", "b9", "#9", "#11", "b13"];

export class InvalidChordSymbolError extends Error {
  constructor(value: string) {
    super(`Símbolo de acorde inválido: "${value}"`);
    this.name = "InvalidChordSymbolError";
  }
}

/**
 * Acorde como estrutura musical, não como string.
 *
 * Existe para que transposição, capotraste e simplificação sejam operações
 * corretas e reversíveis em vez de substituição de texto. É o pré-requisito de
 * toda a cifra pessoal (Bloco 8) e dos diagramas de digitação.
 *
 * Aceita os dois formatos que circulam no sistema:
 *  - colon, emitido pelo worker MIR/ChordFormer: "C:maj", "A:min7", "F#:min/C#"
 *  - padrão/brasileiro, digitado por humanos:    "C", "Am7", "C7M", "C#m7(b5)/G#"
 *
 * Não conhece tonalidade. `preferred` chega já resolvido pelo chamador.
 */
export class ChordSymbol extends ValueObject {
  readonly root_pc: number;
  readonly root_spelling: string;
  readonly triad: ChordTriad;
  readonly seventh: ChordSeventh | null;
  readonly extension: ChordExtension | null;
  readonly alterations: string[];
  readonly added: string[];
  readonly bass_pc: number | null;
  readonly bass_spelling: string | null;

  private constructor(props: ChordSymbolProps) {
    super();
    this.root_pc = normalizePitchClass(props.root_pc);
    this.root_spelling = props.root_spelling;
    this.triad = props.triad;
    this.seventh = props.seventh;
    this.extension = props.extension;
    this.alterations = [...props.alterations];
    this.added = [...props.added];
    this.bass_pc =
      props.bass_pc === null ? null : normalizePitchClass(props.bass_pc);
    this.bass_spelling = props.bass_spelling;
  }

  /**
   * Devolve null quando não é parseável — incluindo N/N.C. (silêncio) e lixo.
   * Chamadores devem preservar o texto original nesse caso, nunca descartá-lo:
   * um símbolo exótico que não entendemos ainda é informação para o músico.
   */
  static parse(value: string): ChordSymbol | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    if (ChordSymbol.isNoChord(raw)) return null;

    const withoutSpaces = raw.replace(/\s+/g, "");

    const slashAt = findBassSeparator(withoutSpaces);
    const head =
      slashAt === -1 ? withoutSpaces : withoutSpaces.slice(0, slashAt);
    const bassRaw = slashAt === -1 ? null : withoutSpaces.slice(slashAt + 1);

    let bass_pc: number | null = null;
    let bass_spelling: string | null = null;
    if (bassRaw !== null) {
      const parsedBass = parseNote(bassRaw);
      if (!parsedBass) return null;
      bass_pc = parsedBass.pc;
      bass_spelling = parsedBass.spelling;
    }

    const parsedHead = head.includes(":")
      ? parseColonHead(head)
      : parseSuffixHead(head);
    if (!parsedHead) return null;

    return new ChordSymbol({
      ...parsedHead,
      bass_pc,
      bass_spelling,
    });
  }

  static parseOrThrow(value: string): ChordSymbol {
    const parsed = ChordSymbol.parse(value);
    if (!parsed) throw new InvalidChordSymbolError(String(value ?? ""));
    return parsed;
  }

  /** "N", "N.C.", "NC", "no_chord" — silêncio no timeline, não é acorde. */
  static isNoChord(value: string): boolean {
    const normalized = String(value ?? "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();
    return NO_CHORD_TOKENS.has(normalized);
  }

  /** Grafia de uma pitch class isolada — usada pelos diagramas e pela key. */
  static spellPitchClass(
    pc: number,
    preferred: ChordAccidentalPreference,
  ): string {
    const table = preferred === "flat" ? FLAT_SPELLING : SHARP_SPELLING;
    return table[normalizePitchClass(pc)];
  }

  /** Nota isolada → pitch class. Devolve null se não for nota. */
  static pitchClassOf(note: string): number | null {
    return parseNote(note)?.pc ?? null;
  }

  transpose(
    semitones: number,
    preferred: ChordAccidentalPreference,
  ): ChordSymbol {
    if (!Number.isFinite(semitones)) {
      throw new InvalidChordSymbolError(String(semitones));
    }
    const steps = Math.trunc(semitones);
    if (steps === 0) return this;

    const root_pc = normalizePitchClass(this.root_pc + steps);
    const bass_pc =
      this.bass_pc === null ? null : normalizePitchClass(this.bass_pc + steps);

    return new ChordSymbol({
      root_pc,
      root_spelling: ChordSymbol.spellPitchClass(root_pc, preferred),
      triad: this.triad,
      seventh: this.seventh,
      extension: this.extension,
      alterations: this.alterations,
      added: this.added,
      bass_pc,
      bass_spelling:
        bass_pc === null
          ? null
          : ChordSymbol.spellPitchClass(bass_pc, preferred),
    });
  }

  /**
   * Reescreve a grafia sem mexer na altura: C# → Db, e o baixo junto.
   *
   * É o que `transpose` NÃO faz quando o intervalo é zero — ele devolve `this`
   * de propósito, para não realocar em cada acorde de uma cifra não transposta.
   * Quem só quer aplicar a preferência enarmônica da tonalidade (o caso do
   * artefato canônico, servido sempre no tom original) precisa desta.
   */
  respell(preferred: ChordAccidentalPreference): ChordSymbol {
    return new ChordSymbol({
      root_pc: this.root_pc,
      root_spelling: ChordSymbol.spellPitchClass(this.root_pc, preferred),
      triad: this.triad,
      seventh: this.seventh,
      extension: this.extension,
      alterations: this.alterations,
      added: this.added,
      bass_pc: this.bass_pc,
      bass_spelling:
        this.bass_pc === null
          ? null
          : ChordSymbol.spellPitchClass(this.bass_pc, preferred),
    });
  }

  /**
   * "Acordes simplificados" — o toggle que o músico iniciante usa.
   * O modelo de IA gera sétimas e tensões com frequência; sem isto, a cifra
   * gerada é intocável para boa parte do público.
   */
  simplify(level: ChordComplexityLevel): ChordSymbol {
    if (level === "full") return this;

    if (level === "simple") {
      // Meio-diminuto (dim + 7m) vira menor com sétima: m7(b5) → m7.
      const triad: ChordTriad =
        this.triad === "dim" && this.seventh === "dom7" ? "min" : this.triad;

      return new ChordSymbol({
        root_pc: this.root_pc,
        root_spelling: this.root_spelling,
        triad,
        seventh: this.seventh,
        extension: null,
        alterations: [],
        added: this.added.filter((a) => a === "6"),
        bass_pc: this.bass_pc,
        bass_spelling: this.bass_spelling,
      });
    }

    // basic: só a tríade, e sem baixo invertido — o iniciante toca a forma fechada.
    const triad: ChordTriad =
      this.triad === "sus2" || this.triad === "sus4" || this.triad === "five"
        ? "maj"
        : this.triad;

    return new ChordSymbol({
      root_pc: this.root_pc,
      root_spelling: this.root_spelling,
      triad,
      seventh: null,
      extension: null,
      alterations: [],
      added: [],
      bass_pc: null,
      bass_spelling: null,
    });
  }

  /**
   * Compara por altura, não por grafia: C#m7 e Dbm7 são o mesmo acorde.
   * É o que o matching de edits usa — o músico gravou "Db" e a IA re-analisou
   * como "C#"; a correção dele continua valendo.
   */
  equalsEnharmonically(other: ChordSymbol | null): boolean {
    if (!other) return false;
    return (
      this.root_pc === other.root_pc &&
      this.bass_pc === other.bass_pc &&
      this.triad === other.triad &&
      this.seventh === other.seventh &&
      this.extension === other.extension &&
      sameSet(this.alterations, other.alterations) &&
      sameSet(this.added, other.added)
    );
  }

  /** Só a fundamental soando com o baixo — usado pelos diagramas. */
  get pitchClasses(): number[] {
    const intervals = triadIntervals(this.triad);
    const set = new Set(
      intervals.map((i) => normalizePitchClass(this.root_pc + i)),
    );

    if (this.seventh === "dom7")
      set.add(normalizePitchClass(this.root_pc + 10));
    if (this.seventh === "maj7")
      set.add(normalizePitchClass(this.root_pc + 11));
    if (this.seventh === "dim7") set.add(normalizePitchClass(this.root_pc + 9));

    if (this.added.includes("6"))
      set.add(normalizePitchClass(this.root_pc + 9));
    if (this.added.includes("add9"))
      set.add(normalizePitchClass(this.root_pc + 2));
    if (this.added.includes("add11"))
      set.add(normalizePitchClass(this.root_pc + 5));

    if (
      this.extension === "9" ||
      this.extension === "11" ||
      this.extension === "13"
    ) {
      set.add(normalizePitchClass(this.root_pc + 2));
    }
    if (this.extension === "11" || this.extension === "13") {
      set.add(normalizePitchClass(this.root_pc + 5));
    }
    if (this.extension === "13") set.add(normalizePitchClass(this.root_pc + 9));

    for (const alt of this.alterations) {
      if (alt === "b5") set.add(normalizePitchClass(this.root_pc + 6));
      if (alt === "#5") set.add(normalizePitchClass(this.root_pc + 8));
      if (alt === "b9") set.add(normalizePitchClass(this.root_pc + 1));
      if (alt === "#9") set.add(normalizePitchClass(this.root_pc + 3));
      if (alt === "#11") set.add(normalizePitchClass(this.root_pc + 6));
      if (alt === "b13") set.add(normalizePitchClass(this.root_pc + 8));
    }

    if (this.bass_pc !== null) set.add(this.bass_pc);

    return [...set].sort((a, b) => a - b);
  }

  toString(): string {
    const base = `${this.root_spelling}${this.qualitySuffix()}`;
    return this.bass_spelling ? `${base}/${this.bass_spelling}` : base;
  }

  toJSON(): ChordSymbolProps {
    return {
      root_pc: this.root_pc,
      root_spelling: this.root_spelling,
      triad: this.triad,
      seventh: this.seventh,
      extension: this.extension,
      alterations: [...this.alterations],
      added: [...this.added],
      bass_pc: this.bass_pc,
      bass_spelling: this.bass_spelling,
    };
  }

  private qualitySuffix(): string {
    let core = "";

    // Meio-diminuto tem grafia própria e não segue a composição tríade+sétima.
    if (this.triad === "dim" && this.seventh === "dom7") {
      core = this.extension ? `m${this.extension}(b5)` : "m7(b5)";
      return core + this.renderAlterations() + this.renderAdded();
    }

    if (this.triad === "dim") {
      core = this.seventh === "dim7" ? "dim7" : "dim";
      return core + this.renderAlterations() + this.renderAdded();
    }

    const triadPart =
      this.triad === "min"
        ? "m"
        : this.triad === "aug"
          ? "aug"
          : this.triad === "sus2"
            ? "sus2"
            : this.triad === "sus4"
              ? "sus4"
              : this.triad === "five"
                ? "5"
                : "";

    if (this.seventh === null) {
      return triadPart + this.renderAlterations() + this.renderAdded();
    }

    // Com extensão, o número da extensão substitui o "7": C7 + 9 → C9.
    const degree = this.extension ?? "7";
    const seventhPart = this.seventh === "maj7" ? `maj${degree}` : degree;

    if (this.triad === "min" && this.seventh === "maj7") {
      core = `m(maj${degree})`;
    } else {
      core = `${triadPart}${seventhPart}`;
    }

    return core + this.renderAlterations() + this.renderAdded();
  }

  private renderAlterations(): string {
    if (this.alterations.length === 0) return "";
    const ordered = ALTERATION_ORDER.filter((a) =>
      this.alterations.includes(a),
    );
    return `(${ordered.join(",")})`;
  }

  private renderAdded(): string {
    // "6" vem antes dos add*: C6add9 é a grafia usual, não Cadd96.
    const sixth = this.added.includes("6") ? ["6"] : [];
    const adds = this.added.filter((a) => a !== "6").sort();
    return [...sixth, ...adds].join("");
  }
}

// ─── Helpers de parsing (privados ao módulo) ─────────────────────────────────

function normalizePitchClass(pc: number): number {
  return ((Math.trunc(pc) % 12) + 12) % 12;
}

function triadIntervals(triad: ChordTriad): number[] {
  switch (triad) {
    case "min":
      return [0, 3, 7];
    case "dim":
      return [0, 3, 6];
    case "aug":
      return [0, 4, 8];
    case "sus2":
      return [0, 2, 7];
    case "sus4":
      return [0, 5, 7];
    case "five":
      return [0, 7];
    default:
      return [0, 4, 7];
  }
}

function parseNote(value: string): { pc: number; spelling: string } | null {
  const raw = String(value ?? "").trim();
  const m = raw.match(/^([A-Ga-g])([#b♯♭]?)$/);
  if (!m) return null;

  const letter = m[1].toUpperCase();
  const accidentalRaw = m[2] ?? "";
  const accidental =
    accidentalRaw === "♯" ? "#" : accidentalRaw === "♭" ? "b" : accidentalRaw;

  const natural = NATURAL_PITCH_CLASS[letter];
  if (typeof natural !== "number") return null;

  const delta = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return {
    pc: normalizePitchClass(natural + delta),
    spelling: `${letter}${accidental}`,
  };
}

/**
 * Encontra a "/" que separa o baixo. Ignora a que aparece dentro de parênteses
 * de alteração, e exige que o que vem depois pareça uma nota — assim "C/E" casa
 * mas "sus4/9" (que é qualidade, não inversão) não é cortado errado.
 */
function findBassSeparator(value: string): number {
  let depth = 0;
  for (let i = value.length - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === ")") depth++;
    else if (ch === "(") depth--;
    else if (ch === "/" && depth === 0) {
      const tail = value.slice(i + 1);
      return parseNote(tail) ? i : -1;
    }
  }
  return -1;
}

type ParsedHead = Omit<ChordSymbolProps, "bass_pc" | "bass_spelling">;

/** Formato do worker MIR: "C:maj", "A:min7", "Bb:hdim7". */
function parseColonHead(head: string): ParsedHead | null {
  const idx = head.indexOf(":");
  const rootRaw = head.slice(0, idx);
  const qualityRaw = head.slice(idx + 1).toLowerCase();

  const root = parseNote(rootRaw);
  if (!root) return null;

  const mapped = COLON_QUALITY[qualityRaw];
  if (!mapped) return null;

  return {
    root_pc: root.pc,
    root_spelling: root.spelling,
    triad: mapped.triad,
    seventh: mapped.seventh,
    extension: mapped.extension ?? null,
    alterations: mapped.alterations ?? [],
    added: mapped.added ?? [],
  };
}

/** Notação padrão/brasileira: "C", "Am7", "C7M", "C#m7(b5)". */
function parseSuffixHead(head: string): ParsedHead | null {
  const rootMatch = head.match(/^([A-Ga-g][#b♯♭]?)/);
  if (!rootMatch) return null;

  const root = parseNote(rootMatch[1]);
  if (!root) return null;

  let rest = head.slice(rootMatch[1].length);

  // Extrai as alterações entre parênteses antes de casar o sufixo, senão
  // "m7(b5)" competiria com "m7" na tabela por prefixo.
  const explicitAlterations: string[] = [];
  rest = rest.replace(/\(([^)]*)\)/g, (_full, inner: string) => {
    for (const token of String(inner).split(/[,;]/)) {
      const normalized = ALTERATION_ALIASES[token.trim().toLowerCase()];
      if (normalized) explicitAlterations.push(normalized);
      else return _full; // token desconhecido: devolve intacto e deixa o sufixo falhar
    }
    return "";
  });

  const matched = matchSuffix(rest);
  if (!matched) return null;

  const alterations = dedupe([
    ...(matched.mapped.alterations ?? []),
    ...explicitAlterations,
  ]);

  const { triad, alterations: normalizedAlterations } = absorbTriadAlterations(
    matched.mapped.triad,
    alterations,
  );

  return {
    root_pc: root.pc,
    root_spelling: root.spelling,
    triad,
    seventh: matched.mapped.seventh,
    extension: matched.mapped.extension ?? null,
    alterations: normalizedAlterations,
    added: dedupe(matched.mapped.added ?? []),
  };
}

/**
 * Algumas "alterações" na verdade redefinem a tríade. "Cm7(b5)" e "Cm7b5" são o
 * mesmo acorde meio-diminuto, mas só o segundo casa direto na tabela de sufixos —
 * no primeiro o (b5) é extraído como alteração antes do match. Sem esta
 * normalização os dois produziriam tríades diferentes (min vs dim), e o matching
 * de edits deixaria de reconhecer a correção do músico entre as duas grafias.
 */
function absorbTriadAlterations(
  triad: ChordTriad,
  alterations: string[],
): { triad: ChordTriad; alterations: string[] } {
  if (triad === "min" && alterations.includes("b5")) {
    return { triad: "dim", alterations: alterations.filter((a) => a !== "b5") };
  }
  if (triad === "maj" && alterations.includes("#5")) {
    return { triad: "aug", alterations: alterations.filter((a) => a !== "#5") };
  }
  return { triad, alterations };
}

/** Sufixos cuja caixa é semanticamente significativa: Cm (menor) ≠ CM (maior). */
const CASE_SENSITIVE_SUFFIXES = new Set(["m", "M"]);

function matchSuffix(
  rest: string,
): { mapped: (typeof SUFFIX_TABLE)[number][1] } | null {
  const normalized = rest.trim();

  if (normalized === "") {
    return { mapped: { triad: "maj", seventh: null } };
  }

  // Passe 1 — igualdade exata. Resolve o par ambíguo m/M antes de qualquer
  // normalização de caixa: sem isto, "CM" casaria com "m" e viraria dó menor.
  for (const [suffix, mapped] of SUFFIX_TABLE) {
    if (suffix === "") continue;
    if (normalized === suffix) return { mapped };
  }

  // Passe 2 — tolerante à caixa, exceto nos sufixos ambíguos.
  for (const [suffix, mapped] of SUFFIX_TABLE) {
    if (suffix === "" || CASE_SENSITIVE_SUFFIXES.has(suffix)) continue;
    if (normalized.toLowerCase() === suffix.toLowerCase()) return { mapped };
  }

  return null;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}
