import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { SyncedLyrics } from "../../../domain";
import { IChordSheetReadModel } from "../../gateways/chord-sheet-read-model.interface";
import {
  ChordSheetAlignmentOutput,
  ChordSheetChordTimelineItemOutput,
  ChordSheetLyricsOutput,
  ChordSheetMetaOutput,
  ChordSheetOutput,
  ChordSheetTokenOutput,
} from "../common/chord-sheet-output";
import {
  GetChordSheetForMusicLibraryInput,
  GetChordSheetForMusicLibraryInputConstructorProps,
  ValidateGetChordSheetForMusicLibraryInput,
} from "./get-chord-sheet-for-music-library.input";

type LrcNormalizedLine = {
  start_ms: number;
  end_ms: number | null;
  text: string;
  words?: { start_ms: number; end_ms: number | null; text: string }[];
};

type LrcNormalized = {
  lines: LrcNormalizedLine[];
  meta?: { has_word_timestamps?: boolean };
};

type StructureSegment = {
  startMs: number;
  endMs: number;
  label?: string;
  confidence?: number;
};

export class GetChordSheetForMusicLibraryUseCase implements IUseCase<
  GetChordSheetForMusicLibraryInput,
  ChordSheetOutput
> {
  constructor(private readonly readModel: IChordSheetReadModel) {}

  async execute(
    input:
      | GetChordSheetForMusicLibraryInput
      | GetChordSheetForMusicLibraryInputConstructorProps,
  ): Promise<ChordSheetOutput> {
    const validatedInput =
      input instanceof GetChordSheetForMusicLibraryInput
        ? input
        : new GetChordSheetForMusicLibraryInput(input);

    const errors =
      ValidateGetChordSheetForMusicLibraryInput.validate(validatedInput);
    if (errors.length) {
      const notification = new Notification();

      for (const error of errors as any[]) {
        const field = String(error?.property ?? "");
        const constraints = error?.constraints;
        if (constraints && typeof constraints === "object") {
          for (const message of Object.values(constraints)) {
            notification.addError(String(message), field || undefined);
          }
          continue;
        }
        notification.addError("Validation failed", field || undefined);
      }

      throw new EntityValidationError(notification.toJSON());
    }

    const item = await this.readModel.getMusicLibraryById(
      validatedInput.music_library_id,
    );
    if (!item || item.musicianId !== validatedInput.musician_id) {
      throw new NotFoundError(validatedInput.music_library_id, SyncedLyrics);
    }

    const lyrics = this.buildLyrics(
      item.lrc_normalized,
      item.structure_segments,
    );
    const chords = this.buildChords(item.chords, item.key);
    const alignment = this.buildAlignment(lyrics, chords);
    const meta = this.buildMeta(item);

    return {
      music_library_id: item.id,
      musician_id: item.musicianId,
      title: item.title,
      artist: item.artist,
      lyrics,
      chords: {
        timeline: chords,
      },
      alignment,
      meta,
      updated_at: item.updated_at,
    };
  }

  private buildLyrics(
    lrc_normalized: unknown | null,
    structure_segments: unknown | null,
  ): ChordSheetLyricsOutput {
    const normalized = this.coerceLrcNormalized(lrc_normalized);

    const segments = this.coerceStructureSegments(structure_segments);
    const sections =
      segments.length > 0
        ? segments.map((s) => ({
            label: s.label,
            startMs: s.startMs,
            endMs: s.endMs,
            confidence: s.confidence,
            lines: [] as Array<{ tokens: ChordSheetTokenOutput[] }>,
          }))
        : [
            {
              lines: [] as Array<{ tokens: ChordSheetTokenOutput[] }>,
            },
          ];

    const normalizedLines = normalized?.lines ?? [];

    const buildApproxWords = (
      text: string,
      timing: { startMs: number; endMs: number },
    ): Array<{ text: string; startMs: number; endMs?: number }> => {
      const raw = String(text ?? "");
      const matches = raw.match(
        /(\s+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]+)/gu,
      );

      const words = (matches ?? []).filter((m) => /^[\p{L}\p{N}]/u.test(m));
      if (words.length === 0) return [];

      const lengths = words.map((w) => Math.max(1, Array.from(w).length));
      const total = lengths.reduce((sum, n) => sum + n, 0);
      const duration = Math.max(0, timing.endMs - timing.startMs);
      if (total <= 0 || duration <= 0) return [];

      let cursor = timing.startMs;
      const out: Array<{ text: string; startMs: number; endMs?: number }> = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const part =
          i === words.length - 1
            ? timing.endMs - cursor
            : Math.round((duration * lengths[i]) / total);
        const next = Math.min(timing.endMs, cursor + Math.max(1, part));
        out.push({ text: w, startMs: cursor, endMs: next });
        cursor = next;
      }
      return out;
    };

    for (let idx = 0; idx < normalizedLines.length; idx++) {
      const line = normalizedLines[idx];
      const next = normalizedLines[idx + 1];
      const nextStartMs =
        typeof next?.start_ms === "number" ? next.start_ms : 0;

      const startMs = line.start_ms;
      const endMs =
        typeof line.end_ms === "number" && line.end_ms > startMs
          ? line.end_ms
          : typeof next?.start_ms === "number" && nextStartMs > startMs
            ? nextStartMs
            : undefined;

      const wordsFromLine = this.coerceLineWords(line);
      const words =
        (!wordsFromLine || wordsFromLine.length === 0) &&
        typeof endMs === "number" &&
        Number.isFinite(endMs) &&
        endMs > startMs
          ? buildApproxWords(line.text, { startMs, endMs })
          : wordsFromLine;

      const tokens = this.tokenize(line.text, {
        startMs,
        endMs,
        words,
      });
      const sectionIndex =
        segments.length > 0
          ? this.pickSectionIndexForStartMs(line.start_ms, segments)
          : 0;
      sections[sectionIndex]?.lines.push({ tokens });
    }

    return {
      normalized: {
        sections,
      },
    };
  }

  private coerceLrcNormalized(value: unknown | null): LrcNormalized | null {
    if (!value || typeof value !== "object") return null;
    const v = value as any;
    if (!Array.isArray(v.lines)) return null;
    const meta =
      v.meta && typeof v.meta === "object"
        ? {
            has_word_timestamps:
              typeof v.meta.has_word_timestamps === "boolean"
                ? v.meta.has_word_timestamps
                : undefined,
          }
        : undefined;
    const lines = v.lines
      .filter((l: any) => l && typeof l === "object")
      .map((l: any) => {
        const start_ms = Number(l.start_ms);
        const end_ms =
          l.end_ms === null || l.end_ms === undefined ? null : Number(l.end_ms);
        const text = String(l.text ?? "");
        if (!Number.isFinite(start_ms) || start_ms < 0) return null;
        if (end_ms !== null && (!Number.isFinite(end_ms) || end_ms < 0))
          return null;

        const words = Array.isArray(l.words)
          ? l.words
              .filter((w: any) => w && typeof w === "object")
              .map((w: any) => {
                const wStart = Number(w.start_ms);
                const wEnd =
                  w.end_ms === null || w.end_ms === undefined
                    ? null
                    : Number(w.end_ms);
                const wText = String(w.text ?? "");
                if (!Number.isFinite(wStart) || wStart < 0) return null;
                if (wEnd !== null && (!Number.isFinite(wEnd) || wEnd < 0))
                  return null;
                return { start_ms: wStart, end_ms: wEnd, text: wText };
              })
              .filter(Boolean)
          : undefined;

        return { start_ms, end_ms, text, ...(words ? { words } : {}) };
      })
      .filter(Boolean) as LrcNormalizedLine[];
    return { lines, ...(meta ? { meta } : {}) };
  }

  private tokenize(
    text: string,
    timing?: {
      startMs?: number;
      endMs?: number;
      words?: Array<{ text: string; startMs: number; endMs?: number }>;
    },
  ): ChordSheetTokenOutput[] {
    const raw = String(text ?? "");
    const matches = raw.match(
      /(\s+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]+)/gu,
    );

    const out: ChordSheetTokenOutput[] = [];
    let wordIndex = 0;
    for (const m of matches ?? []) {
      const isSpace = /^\s+$/u.test(m);
      const isWord = /^[\p{L}\p{N}]/u.test(m);
      const kind: ChordSheetTokenOutput["kind"] = isSpace
        ? "space"
        : isWord
          ? "word"
          : "punct";
      const normalized =
        kind === "word" ? this.normalizeWord(m) : kind === "space" ? m : m;

      const token: ChordSheetTokenOutput = {
        text: m,
        kind,
        normalized,
      };

      if (kind !== "space") {
        if (kind === "word" && timing?.words && timing.words[wordIndex]) {
          const w = timing.words[wordIndex];
          token.startMs = w.startMs;
          if (typeof w.endMs === "number") token.endMs = w.endMs;
          wordIndex += 1;
        } else {
          if (typeof timing?.startMs === "number") {
            token.startMs = timing.startMs;
          }
          if (typeof timing?.endMs === "number") {
            token.endMs = timing.endMs;
          }
          if (kind === "word") wordIndex += 1;
        }
      }

      out.push(token);
    }
    return out;
  }

  private normalizeWord(value: string): string {
    return value
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase();
  }

  private buildChords(
    value: unknown | null,
    key: string | null,
  ): ChordSheetChordTimelineItemOutput[] {
    if (!value) return [];

    const maybeArray = Array.isArray(value)
      ? value
      : typeof value === "object" && value
        ? (value as any).timeline
        : null;

    const arr = Array.isArray(maybeArray) ? maybeArray : [];
    const out: ChordSheetChordTimelineItemOutput[] = [];

    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const i = item as any;

      const rawSymbol = i.symbol ?? i.chord ?? i.label;
      if (typeof rawSymbol !== "string" || !rawSymbol.trim()) continue;

      const symbol = this.formatChordSymbol(rawSymbol.trim(), key);
      if (!symbol) continue;
      if (this.isNoChordSymbol(this.normalizeChordSymbol(symbol))) continue;

      const startMsCandidate =
        typeof i.startMs === "number"
          ? i.startMs
          : typeof i.start_ms === "number"
            ? i.start_ms
            : typeof i.start_seconds === "number"
              ? i.start_seconds * 1000
              : null;

      if (
        typeof startMsCandidate !== "number" ||
        !Number.isFinite(startMsCandidate) ||
        startMsCandidate < 0
      ) {
        continue;
      }

      const endMsCandidate =
        typeof i.endMs === "number"
          ? i.endMs
          : typeof i.end_ms === "number"
            ? i.end_ms
            : typeof i.end_seconds === "number"
              ? i.end_seconds * 1000
              : undefined;

      const confidence =
        typeof i.confidence === "number" && Number.isFinite(i.confidence)
          ? i.confidence
          : undefined;

      const mapped: ChordSheetChordTimelineItemOutput = {
        startMs: Math.round(startMsCandidate),
        symbol,
        ...(typeof endMsCandidate === "number" &&
        Number.isFinite(endMsCandidate)
          ? { endMs: Math.round(endMsCandidate) }
          : {}),
        ...(typeof confidence === "number" ? { confidence } : {}),
      };
      out.push(mapped);
    }

    out.sort((a, b) => a.startMs - b.startMs);

    for (let i = 0; i < out.length; i++) {
      const curr = out[i];
      const next = out[i + 1];
      const nextStart = next?.startMs;

      if (
        typeof curr.endMs !== "number" ||
        !Number.isFinite(curr.endMs) ||
        curr.endMs <= curr.startMs
      ) {
        if (typeof nextStart === "number" && nextStart > curr.startMs) {
          curr.endMs = nextStart;
        } else {
          delete (curr as any).endMs;
        }
      } else if (
        typeof nextStart === "number" &&
        Number.isFinite(nextStart) &&
        curr.endMs > nextStart
      ) {
        curr.endMs = nextStart;
      }
    }

    const merged: ChordSheetChordTimelineItemOutput[] = [];
    const mergeGapMs = 120;
    for (const item of out) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        this.normalizeChordSymbol(prev.symbol) ===
          this.normalizeChordSymbol(item.symbol) &&
        typeof prev.endMs === "number" &&
        item.startMs <= prev.endMs + mergeGapMs
      ) {
        if (typeof item.endMs === "number") {
          prev.endMs = Math.max(prev.endMs, item.endMs);
        }
        if (typeof item.confidence === "number") {
          prev.confidence =
            typeof prev.confidence === "number"
              ? Math.max(prev.confidence, item.confidence)
              : item.confidence;
        }
        continue;
      }
      merged.push({ ...item });
    }

    const filtered = merged.filter((c) => {
      const duration = typeof c.endMs === "number" ? c.endMs - c.startMs : null;
      if (duration !== null && duration < 180) {
        const conf = typeof c.confidence === "number" ? c.confidence : 1;
        if (conf < 0.35) return false;
      }
      return true;
    });

    return this.filterChordsByHarmonicCoherence(filtered, key);
  }

  private formatChordSymbol(symbol: string, key: string | null): string {
    const raw = String(symbol ?? "").trim();
    if (!raw) return "";

    const upper = raw.replace(/\s+/g, "").toUpperCase();
    if (
      upper === "N" ||
      upper === "NC" ||
      upper === "NOCHORD" ||
      upper === "NO_CHORD"
    ) {
      return "N";
    }

    const colon = this.parseColonChord(raw);
    if (!colon) return raw;

    const root = this.applyEnharmonicPreferenceToRoot(colon.root, key);
    const quality = colon.quality;

    const qualitySuffix = this.mapColonQualityToSuffix(quality);
    if (qualitySuffix === null) return raw;

    const base = `${root}${qualitySuffix}`;

    if (colon.bass) {
      const bass = this.applyEnharmonicPreferenceToRoot(colon.bass, key);
      return `${base}/${bass}`;
    }
    return base;
  }

  private parseColonChord(
    value: string,
  ): { root: string; quality: string; bass?: string } | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const m = raw.match(
      /^([A-Ga-g])([#b]?)[ ]*:[ ]*([^\s/]+)(?:\s*\/\s*([A-Ga-g])([#b]?))?\s*$/i,
    );
    if (!m) return null;
    const root = `${m[1].toUpperCase()}${m[2] ?? ""}`;
    const quality = String(m[3] ?? "").trim();
    const bass = m[4]
      ? `${String(m[4] ?? "").toUpperCase()}${String(m[5] ?? "")}`
      : undefined;
    return { root, quality, ...(bass ? { bass } : {}) };
  }

  private mapColonQualityToSuffix(quality: string): string | null {
    const q = String(quality ?? "")
      .trim()
      .toLowerCase();
    if (!q) return null;

    if (q === "maj" || q === "major") return "";
    if (q === "min" || q === "minor") return "m";

    if (q === "7") return "7";
    if (q === "maj7" || q === "major7") return "maj7";
    if (q === "min7" || q === "minor7" || q === "m7") return "m7";

    if (q === "dim") return "dim";
    if (q === "aug") return "aug";
    if (q === "sus2") return "sus2";
    if (q === "sus4" || q === "sus") return "sus4";

    return null;
  }

  private applyEnharmonicPreferenceToRoot(
    root: string,
    key: string | null,
  ): string {
    const pc = this.noteToPitchClass(root);
    if (pc === null) return root;
    const preferFlats = this.preferFlatsForKey(key);
    if (preferFlats === null) return root;
    return this.pitchClassToNote(pc, preferFlats);
  }

  private pitchClassToNote(pc: number, preferFlats: boolean): string {
    const sharp = [
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
    const flat = [
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
    const idx = ((pc % 12) + 12) % 12;
    return preferFlats ? flat[idx] : sharp[idx];
  }

  private preferFlatsForKey(value: string | null): boolean | null {
    if (!value || typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    if (/[b♭]/i.test(raw)) return true;
    if (/[#♯]/.test(raw)) return false;
    const m = raw.match(/^([A-Ga-g])/);
    if (!m) return null;
    return m[1].toUpperCase() === "F";
  }

  private filterChordsByHarmonicCoherence(
    chords: ChordSheetChordTimelineItemOutput[],
    key: string | null,
  ): ChordSheetChordTimelineItemOutput[] {
    const keyPc = this.parseKeyToPitchClass(key);
    if (keyPc === null) return chords;
    const isMinor = this.parseKeyIsMinor(key);
    const scale = this.buildScalePitchClasses(keyPc, isMinor);

    return chords.filter((c) => {
      const rootPc = this.parseChordRootToPitchClass(c.symbol);
      if (rootPc === null) return true;
      if (scale.has(rootPc)) return true;

      const conf = typeof c.confidence === "number" ? c.confidence : 1;
      const duration =
        typeof c.endMs === "number" ? c.endMs - c.startMs : 999999;

      if (conf >= 0.75) return true;
      if (duration >= 1000) return true;
      return false;
    });
  }

  private parseKeyToPitchClass(value: string | null): number | null {
    if (!value || typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    const m = raw.match(/^([A-Ga-g])([#b])?/);
    if (!m) return null;
    const letter = m[1].toUpperCase();
    const accidental = m[2] ?? "";
    return this.noteToPitchClass(`${letter}${accidental}`);
  }

  private parseKeyIsMinor(value: string | null): boolean {
    if (!value || typeof value !== "string") return false;
    const raw = value.trim();
    if (!raw) return false;
    return /m(in)?\b/i.test(raw) && !/maj(or)?\b/i.test(raw);
  }

  private buildScalePitchClasses(rootPc: number, minor: boolean): Set<number> {
    const intervals = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    return new Set(intervals.map((i) => (rootPc + i) % 12));
  }

  private parseChordRootToPitchClass(symbol: string): number | null {
    const raw = String(symbol ?? "").trim();
    if (!raw) return null;
    const m = raw.match(/^([A-Ga-g])([#b])?/);
    if (!m) return null;
    const letter = m[1].toUpperCase();
    const accidental = m[2] ?? "";
    return this.noteToPitchClass(`${letter}${accidental}`);
  }

  private noteToPitchClass(note: string): number | null {
    const n = String(note ?? "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();
    if (!n) return null;

    const base: Record<string, number> = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    };

    const m = n.match(/^([A-G])([#B])?$/);
    if (!m) return null;

    const letter = m[1];
    const accidental = m[2] ?? "";
    const pc = base[letter];
    if (typeof pc !== "number") return null;

    const delta = accidental === "#" ? 1 : accidental === "B" ? -1 : 0;
    return (pc + delta + 12) % 12;
  }

  private buildAlignment(
    lyrics: ChordSheetLyricsOutput,
    chords: ChordSheetChordTimelineItemOutput[],
  ): ChordSheetAlignmentOutput {
    const anchors: ChordSheetAlignmentOutput["anchors"] = {};

    const sections = lyrics.normalized.sections ?? [];
    const sectionLineTimings = sections.map((s) =>
      (s.lines ?? []).map((l) => this.computeLineTiming(l)),
    );

    const sectionRanges = sections.map((s, idx) => {
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
      const sectionIndex = this.pickSectionIndexForChord(
        chord.startMs,
        sectionRanges,
      );
      const lines = sections[sectionIndex]?.lines ?? [];
      const lineTimings = sectionLineTimings[sectionIndex] ?? [];

      const { lineIndex, tokenIndex } = this.findAnchorForChord(
        chord.startMs,
        lines,
        lineTimings,
      );

      anchors[String(chordIndex)] = {
        sectionIndex,
        lineIndex,
        tokenIndex,
      };
    }

    return { anchors };
  }

  private findAnchorForChord(
    chordStartMs: number,
    lines: Array<{ tokens: ChordSheetTokenOutput[] }>,
    timings: Array<{ startMs: number; endMs?: number }>,
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
        Math.min(
          0.999,
          (chordStartMs - lineStartMs) / (lineEndMs - lineStartMs),
        ),
      );
      const weighted = this.pickTokenIndexByWeightedFraction(
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

  private pickTokenIndexByWeightedFraction(
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

  private computeLineTiming(line: { tokens: ChordSheetTokenOutput[] }): {
    startMs: number;
    endMs?: number;
  } {
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

  private normalizeChordSymbol(value: string): string {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .replace(/[.\s]+/g, "")
      .toLowerCase();
  }

  private isNoChordSymbol(normalized: string): boolean {
    const v = String(normalized ?? "").trim();
    return v === "n" || v === "nc";
  }

  private coerceStructureSegments(value: unknown | null): StructureSegment[] {
    if (!value) return [];

    const arr = Array.isArray(value)
      ? value
      : typeof value === "object" && value
        ? (value as any).segments
        : null;

    const items = Array.isArray(arr) ? arr : [];
    const out: StructureSegment[] = [];

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const i = item as any;

      const startMsCandidate =
        typeof i.startMs === "number"
          ? i.startMs
          : typeof i.start_ms === "number"
            ? i.start_ms
            : typeof i.start_seconds === "number"
              ? i.start_seconds * 1000
              : null;

      const endMsCandidate =
        typeof i.endMs === "number"
          ? i.endMs
          : typeof i.end_ms === "number"
            ? i.end_ms
            : typeof i.end_seconds === "number"
              ? i.end_seconds * 1000
              : null;

      if (
        typeof startMsCandidate !== "number" ||
        !Number.isFinite(startMsCandidate) ||
        startMsCandidate < 0
      ) {
        continue;
      }

      if (
        typeof endMsCandidate !== "number" ||
        !Number.isFinite(endMsCandidate) ||
        endMsCandidate <= startMsCandidate
      ) {
        continue;
      }

      const label =
        typeof i.label === "string" && i.label.trim()
          ? i.label.trim()
          : undefined;
      const confidence =
        typeof i.confidence === "number" && Number.isFinite(i.confidence)
          ? i.confidence
          : undefined;

      out.push({
        startMs: Math.round(startMsCandidate),
        endMs: Math.round(endMsCandidate),
        ...(label ? { label } : {}),
        ...(typeof confidence === "number" ? { confidence } : {}),
      });
    }

    out.sort((a, b) => a.startMs - b.startMs);
    return out;
  }

  private pickSectionIndexForStartMs(
    startMs: number,
    segments: StructureSegment[],
  ): number {
    if (segments.length === 0) return 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (startMs >= seg.startMs && startMs < seg.endMs) return i;
    }

    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const distance =
        startMs < seg.startMs
          ? seg.startMs - startMs
          : startMs > seg.endMs
            ? startMs - seg.endMs
            : 0;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }

    return best;
  }

  private pickSectionIndexForChord(
    chordStartMs: number,
    ranges: Array<{ startMs: number; endMs?: number; hasLines: boolean }>,
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

  private coerceLineWords(
    line: LrcNormalizedLine,
  ): Array<{ text: string; startMs: number; endMs?: number }> | undefined {
    if (!Array.isArray(line.words) || line.words.length === 0) return undefined;

    const words = line.words
      .filter((w) => w && typeof w === "object")
      .map((w) => ({
        text: String((w as any).text ?? ""),
        startMs: Math.round(Number((w as any).start_ms)),
        endMs:
          (w as any).end_ms === null || (w as any).end_ms === undefined
            ? undefined
            : Math.round(Number((w as any).end_ms)),
      }))
      .filter((w) => Number.isFinite(w.startMs) && w.startMs >= 0);

    words.sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < words.length; i++) {
      const curr = words[i];
      const next = words[i + 1];
      if (
        typeof curr.endMs !== "number" ||
        !Number.isFinite(curr.endMs) ||
        curr.endMs <= curr.startMs
      ) {
        if (typeof next?.startMs === "number" && next.startMs > curr.startMs) {
          curr.endMs = next.startMs;
        } else if (
          typeof line.end_ms === "number" &&
          Number.isFinite(line.end_ms) &&
          line.end_ms > curr.startMs
        ) {
          curr.endMs = line.end_ms;
        } else {
          delete (curr as any).endMs;
        }
      }
    }

    return words;
  }

  private buildMeta(item: {
    lrc_provider: string | null;
    lrc_provider_meta: Record<string, unknown> | null;
    lrc_pipeline_version: number;
    lrc_quality_flags: string[];
    bpm: number | null;
    key: string | null;
  }): ChordSheetMetaOutput {
    const matchScore =
      item.lrc_provider_meta &&
      typeof (item.lrc_provider_meta as any).score === "number" &&
      Number.isFinite((item.lrc_provider_meta as any).score)
        ? ((item.lrc_provider_meta as any).score as number)
        : undefined;

    const meta: ChordSheetMetaOutput = {
      provider: item.lrc_provider,
      pipelineVersion: item.lrc_pipeline_version,
      qualityFlags: item.lrc_quality_flags ?? [],
      bpm: item.bpm,
      key: item.key,
    };

    if (typeof matchScore === "number") {
      meta.matchScore = matchScore;
    }
    return meta;
  }
}
