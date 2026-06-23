import { createHash } from "node:crypto";

import { Either } from "../../../shared/domain/either";
import { ValueObject } from "../../../shared/domain/value-object";

export type SyncedLyricsNormalized = {
  format: "lrc";
  pipeline_version: number;
  meta: {
    tags: Record<string, string>;
    offset_ms: number;
    has_word_timestamps: boolean;
  };
  lines: {
    start_ms: number;
    end_ms: number | null;
    text: string;
  }[];
};

export type LrcParseResult = {
  raw: string;
  hash: string;
  provider: string;
  normalized: SyncedLyricsNormalized;
  quality: {
    flags: string[];
    coverage_ms: number | null;
    has_word_timestamps: boolean;
  };
};

export class InvalidLrcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLrcError";
  }
}

export class LrcRaw extends ValueObject {
  readonly value: string;

  private constructor(value: string) {
    super();
    this.value = value;
    this.validate();
  }

  static create(value: string): Either<LrcRaw, InvalidLrcError> {
    return Either.safe<LrcRaw, InvalidLrcError>(() => new LrcRaw(value));
  }

  private validate() {
    if (typeof this.value !== "string") {
      throw new InvalidLrcError("LRC must be a string");
    }

    const normalized = this.value.replace(/^\uFEFF/, "");
    const bytes = Buffer.byteLength(normalized, "utf8");
    if (bytes === 0) {
      throw new InvalidLrcError("LRC cannot be empty");
    }

    const maxBytes = 1024 * 1024;
    if (bytes > maxBytes) {
      throw new InvalidLrcError("LRC payload too large");
    }
  }
}

export class LrcParser {
  static parse(input: {
    raw: string;
    provider: string;
    pipeline_version?: number;
  }): Either<LrcParseResult, InvalidLrcError> {
    return Either.safe<LrcParseResult, InvalidLrcError>(() => {
      const [lrcRaw, lrcErr] = LrcRaw.create(input.raw).asArray();
      if (lrcErr) {
        throw lrcErr;
      }

      const provider = String(input.provider ?? "").trim();
      if (!provider) {
        throw new InvalidLrcError("LRC provider is required");
      }

      const pipelineVersion = Number(input.pipeline_version ?? 1);
      if (!Number.isInteger(pipelineVersion) || pipelineVersion <= 0) {
        throw new InvalidLrcError("Invalid pipeline version");
      }

      const rawNormalized = LrcParser.normalizeNewlines(lrcRaw.value);

      const { tags, timedLines, flags } = LrcParser.parseLines(rawNormalized);
      if (timedLines.length === 0) {
        throw new InvalidLrcError("LRC must contain at least one timed line");
      }

      const offsetMs = LrcParser.parseOffsetMs(tags);
      const adjusted = timedLines.map((l) => {
        const start = l.start_ms + offsetMs;
        return {
          start_ms: start < 0 ? 0 : start,
          text: l.text,
          original_order: l.original_order,
        };
      });

      if (offsetMs !== 0 && adjusted.some((l) => l.start_ms === 0)) {
        flags.add("negative_timestamp");
      }

      const sorted = adjusted
        .slice()
        .sort(
          (a, b) =>
            a.start_ms - b.start_ms || a.original_order - b.original_order,
        );

      const outOfOrder = adjusted.some((l, i, arr) => {
        if (i === 0) return false;
        return l.start_ms < arr[i - 1].start_ms;
      });
      if (outOfOrder) {
        flags.add("out_of_order");
      }

      const lines = sorted.map((l, idx) => {
        const next = sorted[idx + 1];
        return {
          start_ms: l.start_ms,
          end_ms: next ? next.start_ms : null,
          text: l.text,
        };
      });

      const first = lines[0]?.start_ms ?? 0;
      const last = lines[lines.length - 1]?.start_ms ?? 0;
      const coverage = last >= first ? last - first : null;

      const normalized: SyncedLyricsNormalized = {
        format: "lrc",
        pipeline_version: pipelineVersion,
        meta: {
          tags,
          offset_ms: offsetMs,
          has_word_timestamps: false,
        },
        lines,
      };

      const hash = LrcParser.sha256(rawNormalized);

      return {
        raw: rawNormalized,
        hash,
        provider,
        normalized,
        quality: {
          flags: Array.from(flags),
          coverage_ms: coverage,
          has_word_timestamps: false,
        },
      };
    });
  }

  private static normalizeNewlines(raw: string) {
    return raw.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  }

  private static sha256(value: string) {
    const hex = createHash("sha256").update(value, "utf8").digest("hex");
    return `sha256:${hex}`;
  }

  private static parseLines(raw: string): {
    tags: Record<string, string>;
    timedLines: { start_ms: number; text: string; original_order: number }[];
    flags: Set<string>;
  } {
    const tags: Record<string, string> = {};
    const timedLines: {
      start_ms: number;
      text: string;
      original_order: number;
    }[] = [];
    const flags = new Set<string>();

    const lines = raw.split("\n");
    const maxLines = 20000;
    if (lines.length > maxLines) {
      throw new InvalidLrcError("LRC has too many lines");
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      const meta = LrcParser.tryParseMetaTag(trimmed);
      if (meta) {
        tags[meta.key] = meta.value;
        continue;
      }

      const parsed = LrcParser.parseTimedLine(trimmed);
      if (!parsed) continue;

      for (const start_ms of parsed.timestamps_ms) {
        timedLines.push({
          start_ms,
          text: parsed.text,
          original_order: timedLines.length,
        });
      }
    }

    if (timedLines.length > 0) {
      const deduped = new Map<
        string,
        { start_ms: number; text: string; original_order: number }
      >();
      for (const item of timedLines) {
        const key = `${item.start_ms}::${item.text}`;
        if (!deduped.has(key)) {
          deduped.set(key, item);
        }
      }
      timedLines.length = 0;
      timedLines.push(...Array.from(deduped.values()));
    }

    return { tags, timedLines, flags };
  }

  private static tryParseMetaTag(
    value: string,
  ): { key: string; value: string } | null {
    const m = value.match(/^\[([a-zA-Z][a-zA-Z0-9_-]{0,31}):(.*)\]$/);
    if (!m) return null;
    const key = m[1].trim().toLowerCase();
    const v = m[2].trim();
    if (!key) return null;
    return { key, value: v };
  }

  private static parseOffsetMs(tags: Record<string, string>): number {
    const v = tags["offset"];
    if (!v) return 0;
    const n = Number(String(v).trim());
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.trunc(n);
  }

  private static parseTimedLine(value: string): {
    timestamps_ms: number[];
    text: string;
  } | null {
    const timestamps: number[] = [];

    const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      const mm = Number(match[1]);
      const ss = Number(match[2]);
      const fracRaw = match[3];
      if (!Number.isFinite(mm) || !Number.isFinite(ss)) {
        continue;
      }
      if (mm < 0 || ss < 0 || ss >= 60) {
        continue;
      }
      let ms = 0;
      if (typeof fracRaw === "string") {
        const frac = Number(fracRaw);
        if (Number.isFinite(frac)) {
          if (fracRaw.length === 1) ms = frac * 100;
          else if (fracRaw.length === 2) ms = frac * 10;
          else ms = frac;
        }
      }
      const total = mm * 60_000 + ss * 1_000 + ms;
      timestamps.push(total);
      lastEnd = re.lastIndex;
    }

    if (timestamps.length === 0) {
      return null;
    }

    const text = value.slice(lastEnd).replace(/^\s+/, "");
    return { timestamps_ms: timestamps, text };
  }
}
