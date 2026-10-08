import type {
  ChordSheetAlignmentOutput,
  ChordSheetChordTimelineItemOutput,
  ChordSheetLyricsOutput,
  ChordSheetTokenOutput,
} from "../use-cases/common/chord-sheet-output";

/**
 * Ancoragem de acordes na letra: para cada acorde do timeline, qual token da
 * letra ele fica em cima.
 *
 * Extraído de GetChordSheetForMusicLibraryUseCase sem nenhuma mudança de
 * comportamento. Precisou sair de lá porque a cifra pessoal (Bloco 8) reancora
 * os acordes depois de aplicar as edições do músico: `alignment.anchors` é
 * indexado POSICIONALMENTE em `chords.timeline`, então um único insert ou delete
 * invalida todos os índices seguintes. Sem recalcular por aqui, a cifra editada
 * renderizaria os acordes na sílaba errada do ponto da edição até o fim — em
 * silêncio, sem erro nenhum.
 *
 * Funções puras: mesma entrada, mesma saída, sem estado nem I/O.
 */

type LineLike = { tokens: ChordSheetTokenOutput[] };
type LineTiming = { startMs: number; endMs?: number };
type SectionRange = { startMs: number; endMs?: number; hasLines: boolean };

export function buildChordAlignment(
  lyrics: ChordSheetLyricsOutput,
  chords: ChordSheetChordTimelineItemOutput[],
): ChordSheetAlignmentOutput {
  const anchors: ChordSheetAlignmentOutput["anchors"] = {};

  const sections = lyrics.normalized.sections ?? [];
  const sectionLineTimings = sections.map((s) =>
    (s.lines ?? []).map((l) => computeLineTiming(l)),
  );

  const sectionRanges: SectionRange[] = sections.map((s, idx) => {
    const lines = s.lines ?? [];
    const timings = sectionLineTimings[idx] ?? [];
    const startFromLines = Math.min(
      ...timings.map((t) => t.startMs).filter((n) => Number.isFinite(n)),
    );
    const endFromLines = Math.max(
      ...timings
        .map((t) => t.endMs)
        .filter(
          (n): n is number => typeof n === "number" && Number.isFinite(n),
        ),
    );
    return {
      startMs:
        typeof s.startMs === "number"
          ? s.startMs
          : Number.isFinite(startFromLines)
            ? startFromLines
            : 0,
      endMs:
        typeof s.endMs === "number"
          ? s.endMs
          : Number.isFinite(endFromLines)
            ? endFromLines
            : undefined,
      hasLines: lines.length > 0,
    };
  });

  for (let chordIndex = 0; chordIndex < chords.length; chordIndex++) {
    const chord = chords[chordIndex];
    const sectionIndex = pickSectionIndexForChord(chord.startMs, sectionRanges);
    const lines = sections[sectionIndex]?.lines ?? [];
    const lineTimings = sectionLineTimings[sectionIndex] ?? [];

    const { lineIndex, tokenIndex } = findAnchorForChord(
      chord.startMs,
      lines,
      lineTimings,
    );

    anchors[String(chordIndex)] = { sectionIndex, lineIndex, tokenIndex };
  }

  return { anchors };
}

export function computeLineTiming(line: LineLike): LineTiming {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const t of line.tokens) {
    if (typeof t.startMs === "number" && Number.isFinite(t.startMs)) {
      start = Math.min(start, t.startMs);
    }
    if (typeof t.endMs === "number" && Number.isFinite(t.endMs)) {
      end = Math.max(end, t.endMs);
    }
  }

  if (!Number.isFinite(start)) return { startMs: 0 };
  if (Number.isFinite(end) && end > start)
    return { startMs: start, endMs: end };
  return { startMs: start };
}

export function pickSectionIndexForChord(
  chordStartMs: number,
  ranges: SectionRange[],
): number {
  if (ranges.length === 0) return 0;

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!r.hasLines) continue;
    if (typeof r.endMs === "number") {
      if (chordStartMs >= r.startMs && chordStartMs < r.endMs) return i;
    } else {
      if (chordStartMs >= r.startMs) return i;
    }
  }

  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const end = typeof r.endMs === "number" ? r.endMs : r.startMs;
    const distance =
      chordStartMs < r.startMs
        ? r.startMs - chordStartMs
        : chordStartMs > end
          ? chordStartMs - end
          : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }

  return best;
}

export function findAnchorForChord(
  chordStartMs: number,
  lines: LineLike[],
  timings: LineTiming[],
): { lineIndex: number; tokenIndex: number } {
  if (lines.length === 0) {
    return { lineIndex: 0, tokenIndex: 0 };
  }

  let lo = 0;
  let hi = timings.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (timings[mid].startMs <= chordStartMs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const line = lines[best];
  const wordIndices = line.tokens
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => t.kind === "word")
    .map(({ idx }) => idx);
  const nonSpaceIndices = line.tokens
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => t.kind !== "space")
    .map(({ idx }) => idx);

  if (nonSpaceIndices.length === 0) {
    return { lineIndex: best, tokenIndex: 0 };
  }

  const candidateIndices =
    wordIndices.length > 0 ? wordIndices : nonSpaceIndices;
  const lineStartMs = timings[best].startMs;
  const lineEndMs = timings[best].endMs;

  const timedCandidates = candidateIndices
    .map((idx) => ({ idx, token: line.tokens[idx] }))
    .filter(({ token }) => typeof token.startMs === "number")
    .map(({ idx, token }) => ({
      idx,
      startMs: token.startMs as number,
      endMs:
        typeof token.endMs === "number" ? (token.endMs as number) : undefined,
    }))
    .sort((a, b) => a.startMs - b.startMs);

  if (timedCandidates.length === 1) {
    return { lineIndex: best, tokenIndex: timedCandidates[0].idx };
  }

  const hasWordLevelTimings =
    timedCandidates.length > 1 &&
    new Set(timedCandidates.map((c) => c.startMs)).size > 1;

  if (timedCandidates.length > 0 && hasWordLevelTimings) {
    let bestToken = timedCandidates[0].idx;
    for (let i = 0; i < timedCandidates.length; i++) {
      const curr = timedCandidates[i];
      const next = timedCandidates[i + 1];
      const end =
        typeof curr.endMs === "number"
          ? curr.endMs
          : typeof next?.startMs === "number"
            ? next.startMs
            : undefined;

      if (curr.startMs <= chordStartMs) {
        bestToken = curr.idx;
      }

      if (
        curr.startMs <= chordStartMs &&
        typeof end === "number" &&
        chordStartMs < end
      ) {
        bestToken = curr.idx;
        break;
      }
    }
    return { lineIndex: best, tokenIndex: bestToken };
  }

  if (
    typeof lineEndMs === "number" &&
    Number.isFinite(lineEndMs) &&
    lineEndMs > lineStartMs &&
    chordStartMs >= lineStartMs
  ) {
    const fraction = Math.max(
      0,
      Math.min(0.999, (chordStartMs - lineStartMs) / (lineEndMs - lineStartMs)),
    );
    const weighted = pickTokenIndexByWeightedFraction(
      line.tokens,
      candidateIndices,
      fraction,
    );
    return { lineIndex: best, tokenIndex: weighted };
  }

  return {
    lineIndex: best,
    tokenIndex: candidateIndices[0] ?? nonSpaceIndices[0],
  };
}

/**
 * Fallback quando não há timestamp por palavra: distribui o acorde na linha
 * proporcionalmente ao TAMANHO dos tokens (palavra longa ocupa mais tempo),
 * não por beat grid.
 */
export function pickTokenIndexByWeightedFraction(
  tokens: ChordSheetTokenOutput[],
  indices: number[],
  fraction: number,
): number {
  const weights = indices.map((idx) => {
    const t = tokens[idx];
    if (t.kind === "word") return Math.max(1, String(t.text).length);
    if (t.kind === "punct") return 0.5;
    return 0;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return indices[0] ?? 0;
  const target = Math.max(0, Math.min(total - 0.0001, fraction * total));
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (acc >= target) return indices[i];
  }
  return indices[indices.length - 1] ?? 0;
}
