import { Cache } from "cache-manager";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  ILrcLibClient,
  LrcLibLyrics,
} from "../../ports/lrclib-client.interface";
import {
  MatchSyncedLyricsOnLrclibInput,
  MatchSyncedLyricsOnLrclibInputConstructorProps,
  ValidateMatchSyncedLyricsOnLrclibInput,
} from "./match-synced-lyrics-on-lrclib.input";

export type LrcLibMatchCandidateOutput = {
  lrclib_id: number;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_seconds: number;
  has_synced: boolean;
  score: number;
};

export type MatchSyncedLyricsOnLrclibOutput = {
  items: LrcLibMatchCandidateOutput[];
  meta: {
    cache: "hit" | "miss" | "negative_hit";
    key: string;
  };
};

export class MatchSyncedLyricsOnLrclibUseCase implements IUseCase<
  MatchSyncedLyricsOnLrclibInput,
  MatchSyncedLyricsOnLrclibOutput
> {
  constructor(
    private readonly lrclib: ILrcLibClient,
    private readonly cache: Cache,
  ) {}

  async execute(
    input:
      | MatchSyncedLyricsOnLrclibInput
      | MatchSyncedLyricsOnLrclibInputConstructorProps,
  ): Promise<MatchSyncedLyricsOnLrclibOutput> {
    const validatedInput =
      input instanceof MatchSyncedLyricsOnLrclibInput
        ? input
        : new MatchSyncedLyricsOnLrclibInput(input);

    const errors =
      ValidateMatchSyncedLyricsOnLrclibInput.validate(validatedInput);
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

    const cacheKey = this.cacheKey(
      validatedInput.artist,
      validatedInput.title,
      validatedInput.duration_ms,
    );

    const cached = await this.cache.get<any>(cacheKey);
    if (cached && typeof cached === "object") {
      if (cached.found === false) {
        return { items: [], meta: { cache: "negative_hit", key: cacheKey } };
      }
      if (Array.isArray(cached.items)) {
        return {
          items: cached.items as LrcLibMatchCandidateOutput[],
          meta: { cache: "hit", key: cacheKey },
        };
      }
    }

    const maxResults = Math.min(
      30,
      Math.max(1, Math.floor(validatedInput.max_results ?? 10)),
    );

    try {
      const items = await this.lrclib.searchLyrics({
        q: `${validatedInput.title} ${validatedInput.artist}`.trim(),
        track_name: validatedInput.title,
        artist_name: validatedInput.artist,
      });

      const candidates = (items ?? [])
        .map((i) => this.toCandidate(i, validatedInput))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      if (!candidates.length) {
        await this.cache.set(cacheKey, { found: false }, 10 * 60);
      } else {
        await this.cache.set(
          cacheKey,
          { found: true, items: candidates },
          6 * 60 * 60,
        );
      }

      return {
        items: candidates,
        meta: { cache: "miss", key: cacheKey },
      };
    } catch (e: any) {
      throw new InvalidOperationError("Falha ao consultar LRCLIB", {
        cause: e,
        metadata: {
          artist: validatedInput.artist,
          title: validatedInput.title,
        },
      });
    }
  }

  private toCandidate(
    item: LrcLibLyrics,
    input: MatchSyncedLyricsOnLrclibInput,
  ): LrcLibMatchCandidateOutput {
    const titleScore = this.textScore(input.title, item.trackName);
    const artistScore = this.textScore(input.artist, item.artistName);

    const durationInputSeconds =
      typeof input.duration_ms === "number"
        ? Math.max(0, input.duration_ms) / 1000
        : null;
    const durationDiff =
      durationInputSeconds === null
        ? 0
        : Math.abs(durationInputSeconds - (item.duration ?? 0));
    const durationScore =
      durationInputSeconds === null
        ? 0.5
        : durationDiff <= 2
          ? 1
          : durationDiff <= 6
            ? 0.8
            : durationDiff <= 12
              ? 0.6
              : 0.3;

    const score = 0.55 * titleScore + 0.35 * artistScore + 0.1 * durationScore;

    return {
      lrclib_id: item.id,
      track_name: item.trackName,
      artist_name: item.artistName,
      album_name: item.albumName,
      duration_seconds: item.duration,
      has_synced: Boolean(item.syncedLyrics),
      score: Number(score.toFixed(4)),
    };
  }

  private textScore(a: string, b: string): number {
    const na = this.normalizeCompare(a);
    const nb = this.normalizeCompare(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.85;

    const ta = new Set(na.split(" ").filter(Boolean));
    const tb = new Set(nb.split(" ").filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter += 1;
    const union = new Set([...ta, ...tb]).size;
    return union ? inter / union : 0;
  }

  private normalizeCompare(value: string): string {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  private cacheKey(artist: string, title: string, durationMs?: number): string {
    const bucketSeconds =
      typeof durationMs === "number"
        ? Math.max(0, Math.round(durationMs / 5000) * 5)
        : null;
    const durationPart = bucketSeconds === null ? "na" : String(bucketSeconds);
    return `synced-lyrics:lrclib:search:${this.normalizeKeyPart(artist)}:${this.normalizeKeyPart(title)}:${durationPart}`;
  }

  private normalizeKeyPart(value: string): string {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 120);
  }
}
