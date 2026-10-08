import {
  type ChordAccidentalPreference,
  ChordSymbol,
} from "../../../shared/domain/value-objects/chord-symbol.vo";
import { buildChordAlignment } from "../../../synced-lyrics/application/services/chord-alignment.service";
import type {
  ChordSheetAnnotationOutput,
  ChordSheetChordTimelineItemOutput,
  ChordSheetOutput,
} from "../../../synced-lyrics/application/use-cases/common/chord-sheet-output";
import type {
  ChordEdit,
  ChordEditType,
} from "../../domain/value-objects/chord-edit.vo";
import type { ChordSheetViewSettings } from "../../domain/value-objects/chord-sheet-view-settings.vo";

/**
 * Janela de tolerância do matching temporal. 250ms é aproximadamente uma
 * semicolcheia a 120 BPM: larga o bastante para absorver o jitter de uma nova
 * análise do modelo, estreita o bastante para não capturar o acorde vizinho.
 */
export const DEFAULT_ANCHOR_TOLERANCE_MS = 250;

export type OverlayConflictReason =
  /** Nenhum acorde do base caiu dentro da janela de tolerância. */
  | "anchor_not_found"
  /** Havia acorde na janela, mas não é o símbolo que o músico corrigiu. */
  | "symbol_mismatch"
  /** Dois acordes igualmente próximos — não dá para adivinhar qual. */
  | "ambiguous_match"
  /** O símbolo do edit não é parseável e há transposição ativa. */
  | "unparseable_symbol"
  /** O instante do edit cai fora da duração da música. */
  | "out_of_range";

export type OverlayEditOutcome = {
  edit_id: string;
  type: ChordEditType;
  status: "applied" | "conflict";
  reason?: OverlayConflictReason;
  /** startMs do acorde que o edit efetivamente casou, quando aplicado. */
  matched_start_ms?: number;
};

export type ChordSheetOverlay = {
  edits: readonly ChordEdit[];
  view: ChordSheetViewSettings;
};

export type OverlayApplyResult = {
  /** Mesmo tipo do base — o cliente não muda nada para ler a cifra pessoal. */
  sheet: ChordSheetOutput;
  outcomes: OverlayEditOutcome[];
  conflict_count: number;
};

/** Tonalidades maiores que se escrevem com bemol. */
const FLAT_MAJOR_KEYS = new Set([5, 10, 3, 8, 1]); // F, Bb, Eb, Ab, Db
/** Tonalidades menores que se escrevem com bemol. */
const FLAT_MINOR_KEYS = new Set([2, 7, 0, 5, 10, 3]); // Dm, Gm, Cm, Fm, Bbm, Ebm

/**
 * Aplica as edições pessoais do músico sobre a cifra gerada pela IA.
 *
 * Recebe o artefato canônico e devolve o MESMO tipo, já com as correções, o tom
 * escolhido e o nível de complexidade aplicados. A cifra original nunca é
 * tocada: este serviço trabalha sobre uma cópia profunda e é 100% determinístico
 * — mesma entrada, mesma saída, sempre.
 *
 * Quando uma edição não encontra mais onde se ancorar (porque a IA re-analisou a
 * música e o timeline mudou), ela vira um CONFLITO explícito em vez de ser
 * aplicada no lugar errado. O músico revisa dois conflitos; ele não descobre no
 * palco que a cifra inteira saiu do lugar.
 */
export class ChordSheetOverlayApplier {
  private readonly toleranceMs: number;

  constructor(options: { anchorToleranceMs?: number } = {}) {
    this.toleranceMs = options.anchorToleranceMs ?? DEFAULT_ANCHOR_TOLERANCE_MS;
  }

  apply(
    base: ChordSheetOutput,
    overlay: ChordSheetOverlay,
  ): OverlayApplyResult {
    const sheet = deepClone(base);
    const outcomes: OverlayEditOutcome[] = [];

    const timeline = [...(sheet.chords?.timeline ?? [])];
    const annotations: Array<{ atMs: number; text: string }> = [];

    // Calculada ANTES do laço, sobre o timeline base: se fosse recalculada a
    // cada insert, o primeiro acorde fora de faixa esticaria o limite e passaria
    // a autorizar os seguintes.
    const baseDurationMs = computeBaseDurationMs(timeline);

    for (const edit of sortEdits(overlay.edits)) {
      switch (edit.type) {
        case "delete_chord":
          outcomes.push(this.applyDelete(timeline, edit));
          break;
        case "replace_chord":
          outcomes.push(this.applyReplace(timeline, edit, overlay.view));
          break;
        case "shift_chord":
          outcomes.push(this.applyShift(timeline, edit));
          break;
        case "insert_chord":
          outcomes.push(
            this.applyInsert(timeline, edit, overlay.view, baseDurationMs),
          );
          break;
        case "relabel_section":
          outcomes.push(this.applyRelabel(sheet, edit));
          break;
        case "annotate":
          annotations.push({ atMs: edit.at_ms, text: edit.text ?? "" });
          outcomes.push({
            edit_id: edit.edit_id,
            type: edit.type,
            status: "applied",
          });
          break;
      }
    }

    normalizeTimeline(timeline);
    sheet.chords = { timeline };

    // Reancoragem obrigatória: anchors é indexado POSICIONALMENTE no timeline,
    // então qualquer insert/delete invalida todos os índices seguintes.
    sheet.alignment = buildChordAlignment(sheet.lyrics, timeline);

    if (annotations.length > 0) {
      sheet.annotations = anchorAnnotations(sheet, annotations);
    }

    this.applyViewSettings(sheet, overlay.view);

    const conflict_count = outcomes.filter(
      (o) => o.status === "conflict",
    ).length;
    return { sheet, outcomes, conflict_count };
  }

  // ─── Edições de acorde ─────────────────────────────────────────────────────

  private applyDelete(
    timeline: ChordSheetChordTimelineItemOutput[],
    edit: ChordEdit,
  ): OverlayEditOutcome {
    const match = this.findMatch(timeline, edit.at_ms, edit.from);
    if (match.status === "conflict") {
      return {
        edit_id: edit.edit_id,
        type: edit.type,
        reason: match.reason,
        status: "conflict",
      };
    }

    const removed = timeline[match.index];
    timeline.splice(match.index, 1);
    return {
      edit_id: edit.edit_id,
      type: edit.type,
      status: "applied",
      matched_start_ms: removed.startMs,
    };
  }

  private applyReplace(
    timeline: ChordSheetChordTimelineItemOutput[],
    edit: ChordEdit,
    view: ChordSheetViewSettings,
  ): OverlayEditOutcome {
    const match = this.findMatch(timeline, edit.at_ms, edit.from);
    if (match.status === "conflict") {
      return {
        edit_id: edit.edit_id,
        type: edit.type,
        reason: match.reason,
        status: "conflict",
      };
    }

    const target = timeline[match.index];
    const newSymbol = edit.to ?? target.symbol;
    timeline[match.index] = { ...target, symbol: newSymbol };
    // Correção humana é verdade absoluta: sem confidence, nunca é filtrada.
    delete (timeline[match.index] as { confidence?: number }).confidence;

    return {
      edit_id: edit.edit_id,
      type: edit.type,
      status: "applied",
      matched_start_ms: target.startMs,
      ...unparseableWarning(newSymbol, view),
    };
  }

  private applyShift(
    timeline: ChordSheetChordTimelineItemOutput[],
    edit: ChordEdit,
  ): OverlayEditOutcome {
    const match = this.findMatch(timeline, edit.at_ms, edit.symbol);
    if (match.status === "conflict") {
      return {
        edit_id: edit.edit_id,
        type: edit.type,
        reason: match.reason,
        status: "conflict",
      };
    }

    const target = timeline[match.index];
    const originalStart = target.startMs;
    const nextStart = edit.to_ms ?? originalStart;
    const duration =
      typeof target.endMs === "number" ? target.endMs - originalStart : null;

    timeline[match.index] = {
      ...target,
      startMs: nextStart,
      ...(duration !== null && duration > 0
        ? { endMs: nextStart + duration }
        : {}),
    };

    return {
      edit_id: edit.edit_id,
      type: edit.type,
      status: "applied",
      matched_start_ms: originalStart,
    };
  }

  private applyInsert(
    timeline: ChordSheetChordTimelineItemOutput[],
    edit: ChordEdit,
    view: ChordSheetViewSettings,
    baseDurationMs: number | null,
  ): OverlayEditOutcome {
    // Insert não precisa CASAR com nada — o músico está acrescentando um acorde
    // que a IA não detectou —, mas precisa cair dentro da música. Sem este
    // limite, um at_ms absurdo (dedo pesado no cliente, edit importado de outra
    // gravação, timeline reancorado) entra no fim do array e o normalizeTimeline
    // reencadeia os endMs em volta dele, deformando a cifra inteira.
    if (
      baseDurationMs !== null &&
      edit.at_ms > baseDurationMs + this.toleranceMs
    ) {
      return {
        edit_id: edit.edit_id,
        type: edit.type,
        status: "conflict",
        reason: "out_of_range",
      };
    }

    timeline.push({ startMs: edit.at_ms, symbol: edit.symbol ?? "" });

    return {
      edit_id: edit.edit_id,
      type: edit.type,
      status: "applied",
      matched_start_ms: edit.at_ms,
      ...unparseableWarning(edit.symbol, view),
    };
  }

  private applyRelabel(
    sheet: ChordSheetOutput,
    edit: ChordEdit,
  ): OverlayEditOutcome {
    const sections = sheet.lyrics?.normalized?.sections ?? [];

    let bestIndex = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < sections.length; i++) {
      const startMs = sections[i].startMs;
      if (typeof startMs !== "number") continue;
      const delta = Math.abs(startMs - edit.at_ms);
      if (delta <= this.toleranceMs && delta < bestDelta) {
        bestDelta = delta;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      return {
        edit_id: edit.edit_id,
        type: edit.type,
        status: "conflict",
        reason: "anchor_not_found",
      };
    }

    sections[bestIndex].label = edit.label ?? sections[bestIndex].label;
    return {
      edit_id: edit.edit_id,
      type: edit.type,
      status: "applied",
      matched_start_ms: sections[bestIndex].startMs,
    };
  }

  // ─── Matching temporal ─────────────────────────────────────────────────────

  private findMatch(
    timeline: ChordSheetChordTimelineItemOutput[],
    atMs: number,
    expectedSymbol: string | null,
  ):
    | { status: "matched"; index: number }
    | { status: "conflict"; reason: OverlayConflictReason } {
    const inWindow: Array<{ index: number; delta: number }> = [];
    for (let i = 0; i < timeline.length; i++) {
      const delta = Math.abs(timeline[i].startMs - atMs);
      if (delta <= this.toleranceMs) inWindow.push({ index: i, delta });
    }

    if (inWindow.length === 0) {
      return { status: "conflict", reason: "anchor_not_found" };
    }

    const candidates = expectedSymbol
      ? inWindow.filter(({ index }) =>
          symbolsMatch(timeline[index].symbol, expectedSymbol),
        )
      : inWindow;

    if (candidates.length === 0) {
      return { status: "conflict", reason: "symbol_mismatch" };
    }

    candidates.sort((a, b) => a.delta - b.delta || a.index - b.index);

    // Empate exato de distância entre acordes distintos: não adivinhamos.
    if (
      candidates.length > 1 &&
      candidates[0].delta === candidates[1].delta &&
      timeline[candidates[0].index].symbol !==
        timeline[candidates[1].index].symbol
    ) {
      return { status: "conflict", reason: "ambiguous_match" };
    }

    return { status: "matched", index: candidates[0].index };
  }

  // ─── Parâmetros de visualização ────────────────────────────────────────────

  private applyViewSettings(
    sheet: ChordSheetOutput,
    view: ChordSheetViewSettings,
  ): void {
    const semitones = view.effectiveDisplaySemitones();
    const complexity = view.chord_complexity;

    if (semitones === 0 && complexity === "full") {
      // Ainda assim marcamos a folha: ela passou pelo overlay do músico.
      sheet.meta = withPersonalFlag(sheet.meta);
      return;
    }

    const transposedKeyPc = transposeKeyPitchClass(
      sheet.meta?.key ?? null,
      semitones,
    );
    const preferred = resolveAccidentalPreference(
      view.preferred_accidental,
      transposedKeyPc,
      isMinorKey(sheet.meta?.key ?? null),
    );

    sheet.chords = {
      timeline: sheet.chords.timeline.map((chord) => ({
        ...chord,
        symbol: renderSymbol(chord.symbol, semitones, complexity, preferred),
      })),
    };

    sheet.meta = withPersonalFlag({
      ...sheet.meta,
      key: renderKey(sheet.meta?.key ?? null, semitones, preferred),
    });
  }
}

// ─── Helpers puros (privados ao módulo) ──────────────────────────────────────

/**
 * Ordem de aplicação determinística.
 *
 * O rank por tipo garante que deletes e replaces casem contra as posições
 * ORIGINAIS antes de qualquer insert entrar no array. O desempate por edit_id
 * cobre o caso real de um lote enviado pelo app inteiro no mesmo milissegundo —
 * sem ele, dois carregamentos do mesmo fork poderiam render cifras diferentes.
 */
function sortEdits(edits: readonly ChordEdit[]): ChordEdit[] {
  return [...edits].sort(
    (a, b) =>
      a.at_ms - b.at_ms ||
      a.orderingRank - b.orderingRank ||
      a.created_at.getTime() - b.created_at.getTime() ||
      (a.edit_id < b.edit_id ? -1 : a.edit_id > b.edit_id ? 1 : 0),
  );
}

/**
 * Ordena e re-encadeia endMs. Replica exatamente a regra de buildChords
 * (get-chord-sheet-for-music-library.use-case.ts) — sem isso, um insert ou
 * delete deixa buracos e sobreposições na linha do tempo.
 *
 * O merge de acordes adjacentes iguais do buildChords NÃO é replicado de
 * propósito: desfazer um acorde que o músico acabou de inserir seria apagar a
 * edição dele.
 */
/**
 * Fim da música segundo o timeline base — o último endMs conhecido, caindo para
 * o último startMs quando o item final não tem fim declarado.
 *
 * null quando não dá para saber (timeline vazio): sem duração conhecida não há
 * o que validar, e recusar tudo seria pior do que aceitar.
 */
function computeBaseDurationMs(
  timeline: readonly ChordSheetChordTimelineItemOutput[],
): number | null {
  let max: number | null = null;
  for (const item of timeline) {
    const end =
      typeof item.endMs === "number" && Number.isFinite(item.endMs)
        ? item.endMs
        : item.startMs;
    if (typeof end !== "number" || !Number.isFinite(end)) continue;
    if (max === null || end > max) max = end;
  }
  return max;
}

function normalizeTimeline(
  timeline: ChordSheetChordTimelineItemOutput[],
): void {
  timeline.sort((a, b) => a.startMs - b.startMs);

  for (let i = 0; i < timeline.length; i++) {
    const curr = timeline[i];
    const nextStart = timeline[i + 1]?.startMs;

    if (
      typeof curr.endMs !== "number" ||
      !Number.isFinite(curr.endMs) ||
      curr.endMs <= curr.startMs
    ) {
      if (typeof nextStart === "number" && nextStart > curr.startMs) {
        curr.endMs = nextStart;
      } else {
        delete (curr as { endMs?: number }).endMs;
      }
    } else if (
      typeof nextStart === "number" &&
      Number.isFinite(nextStart) &&
      curr.endMs > nextStart
    ) {
      curr.endMs = nextStart;
    }
  }
}

/**
 * Ancora as anotações na letra reutilizando exatamente a mesma máquina de
 * alinhamento dos acordes — uma anotação é, para efeito de posicionamento, um
 * acorde sem símbolo.
 */
function anchorAnnotations(
  sheet: ChordSheetOutput,
  annotations: Array<{ atMs: number; text: string }>,
): ChordSheetAnnotationOutput[] {
  const pseudoTimeline: ChordSheetChordTimelineItemOutput[] = annotations.map(
    (a) => ({ startMs: a.atMs, symbol: "" }),
  );
  const { anchors } = buildChordAlignment(sheet.lyrics, pseudoTimeline);

  return annotations.map((annotation, index) => {
    const anchor = anchors[String(index)] ?? {
      sectionIndex: 0,
      lineIndex: 0,
      tokenIndex: 0,
    };
    return {
      atMs: annotation.atMs,
      text: annotation.text,
      sectionIndex: anchor.sectionIndex,
      lineIndex: anchor.lineIndex,
      tokenIndex: anchor.tokenIndex,
    };
  });
}

/**
 * Compara símbolos por ALTURA quando ambos são parseáveis (C#m7 === Dbm7), e cai
 * para comparação textual normalizada quando algum não é. Sem isso, uma correção
 * gravada como "Db" deixaria de casar assim que o modelo passasse a emitir "C#".
 */
function symbolsMatch(actual: string, expected: string): boolean {
  const a = ChordSymbol.parse(actual);
  const b = ChordSymbol.parse(expected);
  // Aceita também a forma SIMPLIFICADA do acorde base: com "acordes simples"
  // a tela mostra "Am" onde o base é "Am7", e é o que o músico viu ao pedir a
  // correção. Os três níveis, e não só o atual, para a edição não virar
  // conflito se ele mudar a simplificação depois.
  if (a && b) {
    return (["full", "simple", "basic"] as const).some((level) =>
      a.simplify(level).equalsEnharmonically(b),
    );
  }

  return normalizeForComparison(actual) === normalizeForComparison(expected);
}

function normalizeForComparison(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[.\s]+/g, "")
    .toLowerCase();
}

/**
 * Um símbolo não parseável entre símbolos transpostos fica no tom errado —
 * o músico precisa saber disso. Sem transposição ativa, não há problema nenhum.
 */
function unparseableWarning(
  symbol: string | null,
  view: ChordSheetViewSettings,
): { reason?: OverlayConflictReason } {
  if (view.effectiveDisplaySemitones() === 0) return {};
  if (!symbol || ChordSymbol.parse(symbol)) return {};
  return { reason: "unparseable_symbol" };
}

function renderSymbol(
  symbol: string,
  semitones: number,
  complexity: ChordSheetViewSettings["chord_complexity"],
  preferred: ChordAccidentalPreference,
): string {
  const parsed = ChordSymbol.parse(symbol);
  // Símbolo que não entendemos fica VERBATIM. Nunca some da cifra.
  if (!parsed) return symbol;

  return parsed.transpose(semitones, preferred).simplify(complexity).toString();
}

function renderKey(
  key: string | null,
  semitones: number,
  preferred: ChordAccidentalPreference,
): string | null {
  if (!key) return null;
  const parsed = ChordSymbol.parse(key);
  if (!parsed) return key;
  return parsed.transpose(semitones, preferred).toString();
}

function transposeKeyPitchClass(
  key: string | null,
  semitones: number,
): number | null {
  const parsed = key ? ChordSymbol.parse(key) : null;
  if (!parsed) return null;
  return (((parsed.root_pc + semitones) % 12) + 12) % 12;
}

function isMinorKey(key: string | null): boolean {
  const parsed = key ? ChordSymbol.parse(key) : null;
  return parsed?.triad === "min";
}

/**
 * Resolve "auto" pela tonalidade DE DESTINO (já transposta), não pela original —
 * transpor uma música de C para Eb tem que produzir Eb/Ab/Bb, não D#/G#/A#.
 */
function resolveAccidentalPreference(
  explicit: ChordSheetViewSettings["preferred_accidental"],
  transposedKeyPc: number | null,
  minor: boolean,
): ChordAccidentalPreference {
  if (explicit === "sharp" || explicit === "flat") return explicit;
  if (transposedKeyPc === null) return "sharp";

  const flatKeys = minor ? FLAT_MINOR_KEYS : FLAT_MAJOR_KEYS;
  return flatKeys.has(transposedKeyPc) ? "flat" : "sharp";
}

function withPersonalFlag(
  meta: ChordSheetOutput["meta"],
): ChordSheetOutput["meta"] {
  const flags = meta?.qualityFlags ?? [];
  return {
    ...meta,
    qualityFlags: flags.includes("personal_overlay")
      ? flags
      : [...flags, "personal_overlay"],
  };
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}
