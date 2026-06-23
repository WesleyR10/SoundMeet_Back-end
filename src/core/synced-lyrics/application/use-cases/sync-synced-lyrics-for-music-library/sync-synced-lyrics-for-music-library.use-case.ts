import {
  ISyncedLyricsRepository,
  SyncedLyrics,
  SyncedLyricsId,
} from "@core/synced-lyrics/domain";
import { Cache } from "cache-manager";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { IGeniusClient } from "../../ports/genius-client.interface";
import { ILrcLibClient } from "../../ports/lrclib-client.interface";
import {
  SyncedLyricsOutput,
  SyncedLyricsOutputMapper,
} from "../common/synced-lyrics-output";
import {
  SyncSyncedLyricsForMusicLibraryInput,
  SyncSyncedLyricsForMusicLibraryInputConstructorProps,
  ValidateSyncSyncedLyricsForMusicLibraryInput,
} from "./sync-synced-lyrics-for-music-library.input";

export class SyncSyncedLyricsForMusicLibraryUseCase implements IUseCase<
  SyncSyncedLyricsForMusicLibraryInput,
  SyncedLyricsOutput
> {
  constructor(
    private readonly repo: ISyncedLyricsRepository,
    private readonly lrclib: ILrcLibClient,
    private readonly cache: Cache,
    private readonly genius?: IGeniusClient,
  ) {}

  async execute(
    input:
      | SyncSyncedLyricsForMusicLibraryInput
      | SyncSyncedLyricsForMusicLibraryInputConstructorProps,
  ): Promise<SyncedLyricsOutput> {
    const validatedInput =
      input instanceof SyncSyncedLyricsForMusicLibraryInput
        ? input
        : new SyncSyncedLyricsForMusicLibraryInput(input);

    const errors =
      ValidateSyncSyncedLyricsForMusicLibraryInput.validate(validatedInput);
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

    const id = new SyncedLyricsId(validatedInput.music_library_id);
    const entity = await this.repo.findById(id);
    if (!entity || entity.musician_id.id !== validatedInput.musician_id) {
      throw new NotFoundError(validatedInput.music_library_id, SyncedLyrics);
    }

    const cachedKey = this.cacheKey(entity.title, entity.artist);
    const force = validatedInput.force === true;

    const debugContext = {
      musician_id: entity.musician_id.id,
      music_library_id: entity.music_library_id.id,
      original_title: entity.title,
      original_artist: entity.artist,
    };

    let cachedValue: any = null;
    if (!force) {
      cachedValue = await this.cache.get(cachedKey);
    }

    const cached =
      cachedValue && typeof cachedValue === "object" ? cachedValue : null;
    const cachedFound = cached?.found === true;
    const cachedNotFound = cached?.found === false;

    let lyrics = cachedFound ? cached?.lyrics : null;
    let lyricsProvider =
      cachedFound && typeof cached?.provider === "string"
        ? cached.provider
        : null;

    if (!lyrics && !cachedNotFound) {
      try {
        const fallback = await this.searchFallback(entity.title, entity.artist);
        const lastError: any = fallback.lastError;

        lyrics = fallback.lyrics;
        if (lyrics) {
          lyricsProvider = "lrcget";
          await this.cache.set(
            cachedKey,
            { found: true, lyrics, provider: lyricsProvider },
            60 * 60,
          );
        }

        if (!lyrics) {
          const getCandidates = this.buildSearchCandidates(
            entity.title,
            entity.artist,
          );

          this.debugLog("lrclib_get_candidates", {
            ...debugContext,
            candidates: getCandidates,
          });

          let found: any = null;
          let getLastError: any = null;
          for (const c of getCandidates) {
            if (!c.title || !c.artist) continue;

            this.debugLog("lrclib_request", {
              ...debugContext,
              op: "get",
              params: {
                track_name: c.title,
                ...(c.artist ? { artist_name: c.artist } : {}),
              },
            });

            try {
              found = await this.lrclib.findLyrics({
                track_name: c.title,
                artist_name: c.artist,
              });
            } catch (e: any) {
              getLastError = e;
              this.debugLog("lrclib_error", {
                ...debugContext,
                op: "get",
                params: {
                  track_name: c.title,
                  ...(c.artist ? { artist_name: c.artist } : {}),
                },
                error: {
                  name: e?.name,
                  message: e?.message,
                  status: e?.response?.status,
                },
              });
              continue;
            }
            if (found?.syncedLyrics || found?.plainLyrics) break;
          }

          if (found?.syncedLyrics || found?.plainLyrics) {
            const raw =
              typeof found?.syncedLyrics === "string" &&
              found.syncedLyrics.trim()
                ? found.syncedLyrics
                : this.plainLyricsToSyntheticLrc(
                    typeof found?.plainLyrics === "string"
                      ? found.plainLyrics
                      : "",
                    {
                      title: entity.title,
                      artist: entity.artist,
                      duration_seconds:
                        typeof found?.duration === "number"
                          ? found.duration
                          : null,
                    },
                  );

            lyrics = {
              syncedLyrics: raw,
              meta: {
                lrclib_id: found.id,
                name: found.name,
                trackName: found.trackName,
                artistName: found.artistName,
                albumName: found.albumName,
                duration: found.duration,
                lang: found.lang,
                isrc: found.isrc,
                spotifyId: found.spotifyId,
                releaseDate: found.releaseDate,
                ...(raw === found?.syncedLyrics
                  ? {}
                  : {
                      matched_by: "get:plain_synthetic",
                    }),
              },
            };
            lyricsProvider = "lrclib";
            await this.cache.set(
              cachedKey,
              { found: true, lyrics, provider: lyricsProvider },
              60 * 60,
            );
          } else if (
            fallback.hadConsultError ||
            (lastError && this.isTransientLrcLibError(lastError)) ||
            (getLastError && this.isTransientLrcLibError(getLastError))
          ) {
            throw new InvalidOperationError("Falha ao consultar LRCLIB", {
              cause: lastError ?? getLastError,
              metadata: {
                title: entity.title,
                artist: entity.artist,
              },
            });
          } else {
            try {
              const plain = await this.genius?.findPlainLyrics({
                title: entity.title,
                artist: entity.artist,
              });

              if (plain?.lyrics) {
                const raw = this.plainLyricsToSyntheticLrc(plain.lyrics, {
                  title: entity.title,
                  artist: entity.artist,
                  duration_seconds: null,
                });

                lyrics = {
                  syncedLyrics: raw,
                  meta: {
                    genius_song_id: plain.meta.song_id,
                    genius_url: plain.meta.url,
                    genius_full_title: plain.meta.full_title,
                    genius_primary_artist_name: plain.meta.primary_artist_name,
                    matched_by: "genius:search+scrape",
                  },
                };
                lyricsProvider = "genius";
                await this.cache.set(
                  cachedKey,
                  { found: true, lyrics, provider: lyricsProvider },
                  60 * 60,
                );
              }
            } catch (e: any) {
              this.debugLog("genius_error", {
                ...debugContext,
                error: {
                  name: e?.name,
                  message: e?.message,
                  status: e?.response?.status,
                },
              });
            }

            if (!lyrics) {
              await this.cache.set(cachedKey, { found: false }, 5 * 60);
              throw new EntityValidationError([
                {
                  lrc_raw: ["Synced lyrics não encontrado para este título"],
                },
              ]);
            }
          }
        }
      } catch (e: any) {
        if (e instanceof EntityValidationError) throw e;
        if (e instanceof InvalidOperationError) throw e;
        throw new InvalidOperationError("Falha ao consultar LRCLIB", {
          cause: e,
          metadata: {
            title: entity.title,
            artist: entity.artist,
          },
        });
      }
    }

    if (!lyrics || typeof lyrics.syncedLyrics !== "string") {
      throw new EntityValidationError([
        {
          lrc_raw: ["Synced lyrics não encontrado para este título"],
        },
      ]);
    }

    entity.upsertFromRaw(
      {
        raw: lyrics.syncedLyrics,
        provider: lyricsProvider ?? "lrclib",
        provider_meta: lyrics.meta ?? null,
      },
      new Date(),
    );

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.repo.update(entity);
    return SyncedLyricsOutputMapper.toOutput(entity);
  }

  private cacheKey(title: string, artist: string): string {
    return `synced-lyrics:lrcget:fetch:${this.normalizeKeyPart(artist)}:${this.normalizeKeyPart(title)}`;
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

  private isDebugEnabled(): boolean {
    return process.env.SYNCED_LYRICS_LRCLIB_DEBUG === "1";
  }

  private isTransientLrcLibError(e: any): boolean {
    const status = e?.response?.status;
    if (typeof status === "number") {
      if (status === 429) return true;
      if (status >= 500) return true;
      return false;
    }

    const code = typeof e?.code === "string" ? e.code : "";
    if (!code) return true;

    return (
      code === "ECONNABORTED" ||
      code === "ETIMEDOUT" ||
      code === "ECONNRESET" ||
      code === "EAI_AGAIN" ||
      code === "ENOTFOUND" ||
      code === "ENETUNREACH"
    );
  }

  private debugLog(event: string, payload: Record<string, unknown>) {
    if (!this.isDebugEnabled()) return;
    console.log(
      JSON.stringify(
        {
          status: event,
          ...payload,
        },
        null,
        2,
      ),
    );
  }

  private async searchFallback(
    title: string,
    artist: string,
  ): Promise<{
    lyrics: { syncedLyrics: string; meta: Record<string, unknown> } | null;
    hadConsultError: boolean;
    lastError: any | null;
  }> {
    const acceptableArtists = this.buildAcceptableArtists(title, artist);
    const candidates = this.buildSearchCandidates(title, artist);

    let hadConsultError = false;
    let lastError: any | null = null;

    this.debugLog("lrclib_search_candidates", {
      original_title: title,
      original_artist: artist,
      acceptable_artists: acceptableArtists,
      candidates,
    });

    for (const c of candidates) {
      if (!c.title) continue;
      if (acceptableArtists.length > 0 && !c.artist) continue;
      const q = c.title.trim();
      if (!q) continue;

      this.debugLog("lrclib_request", {
        original_title: title,
        original_artist: artist,
        op: "search",
        params: {
          q: q ? q : undefined,
          track_name: c.title ? c.title : undefined,
          artist_name: c.artist ? c.artist : undefined,
        },
        candidate: c,
      });

      let result: any;
      try {
        result = await this.lrclib.searchLyrics({
          q: q ? q : undefined,
          track_name: c.title ? c.title : undefined,
          artist_name: c.artist ? c.artist : undefined,
        });
      } catch (e: any) {
        hadConsultError = true;
        lastError = e;
        this.debugLog("lrclib_error", {
          original_title: title,
          original_artist: artist,
          op: "search",
          params: {
            q: q ? q : undefined,
            track_name: c.title ? c.title : undefined,
            artist_name: c.artist ? c.artist : undefined,
          },
          candidate: c,
          error: {
            name: e?.name,
            message: e?.message,
            status: e?.response?.status,
          },
        });
        continue;
      }
      const best = this.pickBestLyrics(result, c.title, acceptableArtists);
      if (best) {
        this.debugLog("lrclib_best_pick", {
          original_title: title,
          original_artist: artist,
          candidate: c,
          picked_meta: best.meta,
        });
        const confirmed = await this.tryConfirmWithGet(best.meta);
        return {
          lyrics: confirmed ?? best,
          hadConsultError,
          lastError,
        };
      }
    }

    const looseTitle = this.cleanTitleForSearch(title);
    const looseArtist = this.cleanArtistForSearch(artist);
    const looseQuery = `${looseTitle} ${looseArtist}`.trim();
    if (looseQuery) {
      this.debugLog("lrclib_request", {
        original_title: title,
        original_artist: artist,
        op: "search",
        params: { q: looseQuery },
        candidate: { title: looseTitle, artist: looseArtist },
      });
      let result: any;
      try {
        result = await this.lrclib.searchLyrics({ q: looseQuery });
      } catch (e: any) {
        hadConsultError = true;
        lastError = e;
        this.debugLog("lrclib_error", {
          original_title: title,
          original_artist: artist,
          op: "search",
          params: { q: looseQuery },
          candidate: { title: looseTitle, artist: looseArtist },
          error: {
            name: e?.name,
            message: e?.message,
            status: e?.response?.status,
          },
        });
        return { lyrics: null, hadConsultError, lastError };
      }
      const best = this.pickBestLyrics(result, looseTitle, acceptableArtists);
      if (best) {
        this.debugLog("lrclib_best_pick", {
          original_title: title,
          original_artist: artist,
          candidate: { title: looseTitle, artist: looseArtist },
          picked_meta: best.meta,
        });
        const confirmed = await this.tryConfirmWithGet(best.meta);
        return {
          lyrics: confirmed ?? best,
          hadConsultError,
          lastError,
        };
      }
    }

    if (looseTitle) {
      this.debugLog("lrclib_request", {
        original_title: title,
        original_artist: artist,
        op: "search",
        params: { q: looseTitle },
        candidate: { title: looseTitle, artist: "" },
      });
      try {
        const result = await this.lrclib.searchLyrics({ q: looseTitle });
        const best = this.pickBestLyrics(result, looseTitle, []);
        if (best) {
          const confirmed = await this.tryConfirmWithGet(best.meta);
          return {
            lyrics: confirmed ?? best,
            hadConsultError,
            lastError,
          };
        }
      } catch (e: any) {
        hadConsultError = true;
        lastError = e;
        this.debugLog("lrclib_error", {
          original_title: title,
          original_artist: artist,
          op: "search",
          params: { q: looseTitle },
          candidate: { title: looseTitle, artist: "" },
          error: {
            name: e?.name,
            message: e?.message,
            status: e?.response?.status,
          },
        });
      }
    }

    return { lyrics: null, hadConsultError, lastError };
  }

  private async tryConfirmWithGet(meta: Record<string, unknown>) {
    const trackName = typeof meta.trackName === "string" ? meta.trackName : "";
    const artistName =
      typeof meta.artistName === "string" ? meta.artistName : "";

    if (!trackName || !artistName) return null;

    try {
      this.debugLog("lrclib_request", {
        op: "get",
        params: {
          track_name: trackName,
          artist_name: artistName,
        },
        context: "confirm",
      });
      const found = await this.lrclib.findLyrics({
        track_name: trackName,
        artist_name: artistName,
      });

      const hasSynced =
        typeof found?.syncedLyrics === "string" && found.syncedLyrics.trim();
      const hasPlain =
        typeof found?.plainLyrics === "string" && found.plainLyrics.trim();
      if (!hasSynced && !hasPlain) return null;

      const raw = hasSynced
        ? String(found.syncedLyrics)
        : this.plainLyricsToSyntheticLrc(String(found.plainLyrics), {
            title: trackName,
            artist: artistName,
            duration_seconds:
              typeof found?.duration === "number" ? found.duration : null,
          });

      return {
        syncedLyrics: raw,
        meta: {
          lrclib_id: found.id,
          name: found.name,
          trackName: found.trackName,
          artistName: found.artistName,
          albumName: found.albumName,
          duration: found.duration,
          lang: found.lang,
          isrc: found.isrc,
          spotifyId: found.spotifyId,
          releaseDate: found.releaseDate,
          matched_by: hasSynced ? "search+get" : "search+get:plain_synthetic",
        },
      };
    } catch (e: any) {
      this.debugLog("lrclib_error", {
        op: "get",
        params: {
          track_name: trackName,
          artist_name: artistName,
        },
        context: "confirm",
        error: {
          name: e?.name,
          message: e?.message,
          status: e?.response?.status,
        },
      });
      return null;
    }
  }

  private buildSearchCandidates(
    rawTitle: string,
    rawArtist: string,
  ): Array<{ title: string; artist: string }> {
    const out: Array<{ title: string; artist: string }> = [];

    const originalTitle = String(rawTitle ?? "").trim();
    const originalArtist = String(rawArtist ?? "").trim();

    const featuringArtists = this.extractFeaturingArtists(originalTitle);

    const cleanArtist = this.cleanArtistForSearch(originalArtist);
    const split = this.splitYoutubeTitle(originalTitle);
    if (split) {
      const left = this.cleanTitleForSearch(split.left);
      const right = this.cleanTitleForSearch(split.right);
      const leftArtist = this.cleanArtistForSearch(split.left);
      const rightArtist = this.cleanArtistForSearch(split.right);

      const artistCompare = this.normalizeForCompare(originalArtist);
      const leftCompare = this.normalizeForCompare(split.left);
      const rightCompare = this.normalizeForCompare(split.right);
      const leftLooksLikeArtist = this.textScore(leftCompare, artistCompare);
      const rightLooksLikeArtist = this.textScore(rightCompare, artistCompare);

      const titleCandidates: Array<{ title: string; artist: string }> = [];

      if (
        right &&
        leftLooksLikeArtist >= 0.55 &&
        leftLooksLikeArtist >= rightLooksLikeArtist + 0.15
      ) {
        const a = leftArtist || cleanArtist;
        if (a) titleCandidates.push({ title: right, artist: a });
      } else if (
        left &&
        rightLooksLikeArtist >= 0.55 &&
        rightLooksLikeArtist >= leftLooksLikeArtist + 0.15
      ) {
        const a = rightArtist || cleanArtist;
        if (a) titleCandidates.push({ title: left, artist: a });
      } else {
        if (right && (leftArtist || cleanArtist)) {
          titleCandidates.push({
            title: right,
            artist: leftArtist || cleanArtist,
          });
        }
        if (left && (rightArtist || cleanArtist)) {
          titleCandidates.push({
            title: left,
            artist: rightArtist || cleanArtist,
          });
        }
        if (right && cleanArtist) {
          titleCandidates.push({ title: right, artist: cleanArtist });
        }
        if (left && cleanArtist) {
          titleCandidates.push({ title: left, artist: cleanArtist });
        }
      }

      for (const tc of titleCandidates) {
        out.push({ title: tc.title, artist: "" });

        out.push(tc);

        const withFeat = this.appendFeaturingArtists(
          tc.artist,
          featuringArtists,
        );
        if (withFeat && withFeat !== tc.artist) {
          out.push({ title: tc.title, artist: withFeat });
        }
      }
    }

    const cleanTitle = this.cleanTitleForSearch(originalTitle);
    if (!split && cleanTitle && cleanArtist) {
      out.push({ title: cleanTitle, artist: "" });

      out.push({ title: cleanTitle, artist: cleanArtist });

      const withFeat = this.appendFeaturingArtists(
        cleanArtist,
        featuringArtists,
      );
      if (withFeat !== cleanArtist) {
        out.push({ title: cleanTitle, artist: withFeat });
      }
    }

    const uniq = new Map<string, { title: string; artist: string }>();
    for (const c of out) {
      const key = `${this.normalizeForCompare(c.artist)}::${this.normalizeForCompare(c.title)}`;
      if (!uniq.has(key)) uniq.set(key, c);
    }
    return [...uniq.values()];
  }

  private splitYoutubeTitle(
    title: string,
  ): { left: string; right: string } | null {
    const t = String(title ?? "").trim();
    const parts = t.split(/\s+[-–—]\s+/, 2);
    if (parts.length !== 2) return null;
    const left = parts[0]?.trim();
    const right = parts[1]?.trim();
    if (!left || !right) return null;
    return { left, right };
  }

  private stripTitleArtifacts(title: string): string {
    let t = String(title ?? "").trim();
    if (!t) return "";

    t = t.replace(/\s*[|｜].*$/u, "").trim();
    t = t
      .replace(/[\[(（【{<＜][\s\S]*?[\])）】}>＞]/gu, (m) => {
        const inner = String(m ?? "").slice(1, -1);
        if (/\b(acoustic|ac[uú]stico)\b/i.test(inner)) {
          return ` ${inner} `;
        }
        return " ";
      })
      .trim();
    t = t.replace(/[@#][\p{L}\p{N}_]+/gu, " ").trim();
    t = t.replace(/\s+/g, " ").trim();

    return t;
  }

  private cleanTitleForSearch(title: string): string {
    let t = String(title ?? "").trim();
    if (!t) return "";

    t = this.stripTitleArtifacts(t);
    t = t
      .replace(
        /\s*(?:ft\.?|feat\.?|featuring|part\.?|participa[cç][aã]o)\b.*$/i,
        "",
      )
      .trim();

    const stripped = this.stripYoutubeNoise(t);
    const clean = this.normalizeForSearch(stripped);
    if (clean) return clean;

    return this.normalizeForSearch(this.stripYoutubeNoise(t));
  }

  private stripYoutubeNoise(value: string): string {
    let v = String(value ?? "");
    if (!v.trim()) return "";

    v = v.replace(
      /\s*\b(official\s+music\s+video|official\s+video|lyric\s+video|music\s+video)\b\s*/gi,
      " ",
    );
    v = v.replace(
      /\s*\b(clipe\s+oficial|video\s+oficial|videoclipe|visualizer|lyrics|legendado|karaoke|remix|remaster(?:ed)?|hq|4k|8k)\b\s*/gi,
      " ",
    );
    v = v.replace(/\s*\b(ao\s+vivo|live)\b\s*/gi, " ");
    v = v.replace(/\s*\b(dvd|show|completo|full)\b\s*/gi, " ");
    v = v.replace(/\s*\b(prod\.?|produ[cç][aã]o)\b\s*[^-–—|｜]+$/gi, " ");

    return v.replace(/\s+/g, " ").trim();
  }

  private extractFeaturingArtists(title: string): string[] {
    const raw = String(title ?? "");
    if (!raw.trim()) return [];

    const m = raw.match(
      /\b(?:ft\.?|feat\.?|featuring|part\.?|participa[cç][aã]o)\b\s*([^|｜\])）】]+)$/i,
    );
    if (!m) return [];

    const tail = m[1] ?? "";
    const normalized = this.normalizeForSearch(tail);
    if (!normalized) return [];

    const parts = normalized
      .split(/\b(?:e|and)\b|,|&/g)
      .map((p) => p.trim())
      .filter(Boolean);

    const out: string[] = [];
    for (const p of parts) {
      const cleaned = this.normalizeForSearch(p);
      if (!cleaned) continue;
      out.push(cleaned);
    }

    return [...new Set(out)].slice(0, 4);
  }

  private appendFeaturingArtists(
    baseArtist: string,
    featuring: string[],
  ): string {
    const base = this.normalizeForSearch(baseArtist);
    if (!base) return "";
    if (!featuring.length) return base;
    const tail = featuring
      .map((a) => this.normalizeForSearch(a))
      .filter(Boolean);
    if (!tail.length) return base;
    return this.normalizeForSearch([base, ...tail].join(" "));
  }

  private buildAcceptableArtists(
    rawTitle: string,
    rawArtist: string,
  ): string[] {
    const out: string[] = [];
    const a = this.cleanArtistForSearch(rawArtist);
    if (a) out.push(a);

    if (a) {
      const parts = a
        .split(/\b(?:e|and)\b|,|&|\//g)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 4);
      for (const p of parts) {
        const cleaned = this.cleanArtistForSearch(p);
        if (cleaned) out.push(cleaned);
      }
    }

    const split = this.splitYoutubeTitle(String(rawTitle ?? "").trim());
    if (split) {
      const left = this.cleanArtistForSearch(split.left);
      const right = this.cleanArtistForSearch(split.right);
      if (left) out.push(left);
      if (right) out.push(right);
    }

    return [...new Set(out)];
  }

  private cleanArtistForSearch(artist: string): string {
    let a = String(artist ?? "").trim();
    if (!a) return "";

    a = a.replace(/\s*[-–—]\s*topic\s*$/i, "").trim();
    a = a
      .replace(
        /\b(topic|oficial|official|vevo|clipe|clip|video|v[íi]deo|lyrics|lyric|visualizer|audio)\b/gi,
        " ",
      )
      .trim();
    a = a.replace(/\band\s+\d+\s+more\b/gi, " ").trim();
    a = a.replace(/\s*(?:ft\.?|feat\.?|featuring)\b.*$/i, "").trim();

    return this.normalizeForSearch(a);
  }

  private normalizeForSearch(value: string): string {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 140);
  }

  private normalizeForCompare(value: string): string {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 200);
  }

  private pickBestLyrics(
    items: Array<any>,
    desiredTitle: string,
    acceptableArtists: string[],
  ): { syncedLyrics: string; meta: Record<string, unknown> } | null {
    const list = Array.isArray(items) ? items : [];
    const t = this.normalizeForCompare(desiredTitle);
    const artists = (acceptableArtists ?? []).map((a) =>
      this.normalizeForCompare(a),
    );

    let best: { item: any; score: number } | null = null;

    for (const item of list) {
      const hasSynced =
        typeof item?.syncedLyrics === "string" && item.syncedLyrics.trim();
      const hasPlain =
        typeof item?.plainLyrics === "string" && item.plainLyrics.trim();
      if (!hasSynced && !hasPlain) continue;
      const itemTitle = this.normalizeForCompare(
        item?.trackName ?? item?.name ?? "",
      );
      const itemArtist = this.normalizeForCompare(item?.artistName ?? "");

      const titleScore = this.textScore(itemTitle, t);
      if (titleScore < 0.55) continue;

      let artistScore = 0;
      for (const a of artists) {
        artistScore = Math.max(artistScore, this.textScore(itemArtist, a));
      }

      if (artists.length > 0) {
        const titleTokens = t.split(" ").filter(Boolean).length;
        const minArtistScore =
          titleTokens <= 2 ? 0.65 : titleTokens <= 3 ? 0.45 : 0.25;
        if (artistScore < minArtistScore) continue;
      }

      const score = 0.72 * titleScore + 0.28 * artistScore + 0.05;

      if (!best || score > best.score) best = { item, score };
    }

    if (!best) return null;
    const picked = best.item;

    const raw =
      typeof picked?.syncedLyrics === "string" && picked.syncedLyrics.trim()
        ? String(picked.syncedLyrics)
        : this.plainLyricsToSyntheticLrc(
            typeof picked?.plainLyrics === "string" ? picked.plainLyrics : "",
            {
              title: String(picked?.trackName ?? desiredTitle ?? ""),
              artist: String(
                picked?.artistName ?? acceptableArtists?.[0] ?? "",
              ),
              duration_seconds:
                typeof picked?.duration === "number" ? picked.duration : null,
            },
          );

    return {
      syncedLyrics: raw,
      meta: {
        lrclib_id: picked.id,
        name: picked.name,
        trackName: picked.trackName,
        artistName: picked.artistName,
        albumName: picked.albumName,
        duration: picked.duration,
        lang: picked.lang,
        isrc: picked.isrc,
        spotifyId: picked.spotifyId,
        releaseDate: picked.releaseDate,
        matched_by:
          raw === picked?.syncedLyrics ? "search" : "search:plain_synthetic",
      },
    };
  }

  private plainLyricsToSyntheticLrc(
    plainLyrics: string,
    meta: { title: string; artist: string; duration_seconds: number | null },
  ): string {
    const title = String(meta.title ?? "").trim();
    const artist = String(meta.artist ?? "").trim();

    const raw = String(plainLyrics ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n");

    const originalLines = raw.split("\n");
    const lines = originalLines
      .map((l) => String(l ?? "").replace(/\s+$/g, ""))
      .slice(0, 20_000);

    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (!nonEmpty.length) {
      return "";
    }

    const durationMsCandidate =
      typeof meta.duration_seconds === "number" &&
      Number.isFinite(meta.duration_seconds) &&
      meta.duration_seconds > 0
        ? Math.round(meta.duration_seconds * 1000)
        : null;

    const fallbackDurationMs = Math.min(
      12 * 60_000,
      Math.max(60_000, nonEmpty.length * 2500),
    );
    const durationMs = durationMsCandidate ?? fallbackDurationMs;

    const stepRaw = durationMs / (nonEmpty.length + 1);
    const stepMs = Math.min(10_000, Math.max(500, Math.round(stepRaw)));

    const out: string[] = [];
    if (artist) out.push(`[ar:${artist}]`);
    if (title) out.push(`[ti:${title}]`);
    out.push(`[sm:synthetic_lrc_v1]`);

    let i = 0;
    for (const line of lines) {
      const t = line.trimEnd();
      if (!t.trim()) {
        continue;
      }
      const startMs = Math.max(0, i * stepMs);
      out.push(`${this.formatLrcTimestamp(startMs)}${t}`);
      i += 1;
    }

    return out.join("\n") + "\n";
  }

  private formatLrcTimestamp(ms: number): string {
    const total = Math.max(0, Math.floor(ms));
    const mm = Math.floor(total / 60_000);
    const ss = Math.floor((total % 60_000) / 1000);
    const cs = Math.floor((total % 1000) / 10);
    const mmStr = String(mm).padStart(2, "0");
    const ssStr = String(ss).padStart(2, "0");
    const csStr = String(cs).padStart(2, "0");
    return `[${mmStr}:${ssStr}.${csStr}]`;
  }

  private textScore(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;

    const ta = new Set(a.split(" ").filter(Boolean));
    const tb = new Set(b.split(" ").filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter += 1;
    const union = new Set([...ta, ...tb]).size;
    return union ? inter / union : 0;
  }
}
