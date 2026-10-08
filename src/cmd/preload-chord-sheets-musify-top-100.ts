import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import axios from "axios";
import { randomUUID } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { AppModule } from "../app.module";
import { CreateAiCifraUploadUseCase } from "../core/ai-cifra/application/use-cases/create-ai-cifra-upload/create-ai-cifra-upload.use-case";
import { GetAiCifraAnalysisJobUseCase } from "../core/ai-cifra/application/use-cases/get-ai-cifra-analysis-job/get-ai-cifra-analysis-job.use-case";
import { RequestAiCifraAnalysisUseCase } from "../core/ai-cifra/application/use-cases/request-ai-cifra-analysis/request-ai-cifra-analysis.use-case";
import { ResolveAiCifraAudioCandidatesUseCase } from "../core/ai-cifra/application/use-cases/resolve-ai-cifra-audio-candidates/resolve-ai-cifra-audio-candidates.use-case";
import {
  MusifyCatalogStreamItem,
  MusifyPipedCatalogClient,
} from "../core/ai-cifra/infra/audio-sources/musify-piped.catalog-client";
import { MaterializeChordSheetsUseCase } from "../core/synced-lyrics/application/use-cases/materialize-chord-sheets/materialize-chord-sheets.use-case";
import { MaterializeRenderableChordSheetsUseCase } from "../core/synced-lyrics/application/use-cases/materialize-renderable-chord-sheets/materialize-renderable-chord-sheets.use-case";
import { SyncSyncedLyricsForMusicLibraryUseCase } from "../core/synced-lyrics/application/use-cases/sync-synced-lyrics-for-music-library/sync-synced-lyrics-for-music-library.use-case";
import { PrismaService } from "../nest-modules/database-module/prisma/prisma.service";

type CliArgs = {
  musician_id: string | null;
  playlist_id: string | null;
  limit: number;
  catalog_limit: number;
  region: string;
  playlist_query_br: string;
  playlist_query_global: string;
  playlists_limit: number;
  only_track: string | null;
  analysis_model_id: string | null;
  analysis_max_wait_ms: number;
  analysis_poll_interval_ms: number;
  force: boolean;
  dry_run: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    musician_id: null,
    playlist_id: null,
    limit: 100,
    catalog_limit: 500,
    region: "BR",
    playlist_query_br: "Top 100 Brasil Spotify",
    playlist_query_global: "Top 100 Global Spotify",
    playlists_limit: 10,
    only_track: null,
    analysis_model_id: null,
    analysis_max_wait_ms: 10 * 60_000,
    analysis_poll_interval_ms: 2_000,
    force: false,
    dry_run: false,
  };

  for (const raw of argv) {
    const [k, v] = raw.includes("=") ? raw.split("=", 2) : [raw, ""];
    const key = k.replace(/^--/, "").trim();
    const value = `${v}`.trim();

    if (key === "musician_id") {
      args.musician_id = value ? value : null;
      continue;
    }
    if (key === "playlist_id") {
      args.playlist_id = value ? value : null;
      continue;
    }
    if (key === "limit") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) args.limit = Math.floor(n);
      continue;
    }
    if (key === "catalog_limit") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) args.catalog_limit = Math.floor(n);
      continue;
    }
    if (key === "region") {
      args.region = value ? value : "BR";
      continue;
    }
    if (key === "playlist_query_br") {
      args.playlist_query_br = value ? value : args.playlist_query_br;
      continue;
    }
    if (key === "playlist_query_global") {
      args.playlist_query_global = value ? value : args.playlist_query_global;
      continue;
    }
    if (key === "playlists_limit") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0)
        args.playlists_limit = Math.max(1, Math.min(20, Math.floor(n)));
      continue;
    }
    if (key === "only_track" || key === "track") {
      args.only_track = value ? value : null;
      continue;
    }
    if (key === "analysis_model_id") {
      args.analysis_model_id = value ? value : null;
      continue;
    }
    if (key === "analysis_max_wait_ms") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0)
        args.analysis_max_wait_ms = Math.floor(n);
      continue;
    }
    if (key === "analysis_poll_interval_ms") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0)
        args.analysis_poll_interval_ms = Math.floor(n);
      continue;
    }
    if (key === "force") {
      args.force = value ? value === "true" : true;
      continue;
    }
    if (key === "dry_run") {
      args.dry_run = value ? value === "true" : true;
      continue;
    }
  }

  return args;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const max = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = new Array(max).fill(0).map(async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function isTransientLrcLibError(e: any): boolean {
  const status = e?.cause?.response?.status ?? e?.response?.status;
  if (typeof status === "number") {
    if (status === 429) return true;
    if (status >= 500) return true;
    return false;
  }

  const code =
    (typeof e?.cause?.code === "string" ? e.cause.code : null) ??
    (typeof e?.code === "string" ? e.code : null) ??
    "";

  if (!code) return false;
  return (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    code === "ENOTFOUND" ||
    code === "ENETUNREACH"
  );
}

async function syncLyricsWithRetry(
  syncLyricsUseCase: SyncSyncedLyricsForMusicLibraryUseCase,
  input: { musician_id: string; music_library_id: string; force: boolean },
): Promise<
  Awaited<ReturnType<SyncSyncedLyricsForMusicLibraryUseCase["execute"]>>
> {
  const max = 3;
  let lastError: any;

  const timeoutRaw = Number(
    process.env.AI_CIFRA_PRELOAD_LYRICS_SYNC_TIMEOUT_MS ?? 30_000,
  );
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw > 0
      ? Math.max(1, Math.floor(timeoutRaw))
      : 30_000;

  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await withTimeout(syncLyricsUseCase.execute(input), timeoutMs);
    } catch (e: any) {
      lastError = e;

      const isConsultError =
        typeof e?.message === "string" &&
        e.message === "Falha ao consultar LRCLIB";
      if (!isConsultError || !isTransientLrcLibError(e)) {
        throw e;
      }

      const base = 1000;
      const backoff = Math.min(60_000, base * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 250);
      const status = e?.cause?.response?.status ?? e?.response?.status;
      const extra = status === 429 ? 30_000 : 0;

      const waitMs = backoff + jitter + extra;

      console.log(
        JSON.stringify(
          {
            status: "lyrics_sync_retry",
            music_library_id: input.music_library_id,
            musician_id: input.musician_id,
            attempt,
            max,
            wait_ms: waitMs,
            error: formatError(e),
          },
          null,
          2,
        ),
      );

      await sleep(waitMs);
    }
  }

  throw lastError;
}

function isNotFoundLyricsError(e: any): boolean {
  if (e?.name === "EntityValidationError") {
    const error = e?.error;
    if (
      Array.isArray(error) &&
      error.some((i) =>
        Array.isArray(i?.lrc_raw)
          ? i.lrc_raw.some(
              (m: any) =>
                typeof m === "string" &&
                m.includes("Synced lyrics não encontrado"),
            )
          : false,
      )
    ) {
      return true;
    }
  }

  if (
    typeof e?.message === "string" &&
    e.message.includes("Synced lyrics não encontrado")
  ) {
    return true;
  }

  return false;
}

function formatError(e: any): string {
  if (e?.name === "EntityValidationError" && Array.isArray(e?.error)) {
    return `Entity Validation Error: ${JSON.stringify(e.error)}`;
  }

  const parts: string[] = [];

  if (typeof e?.name === "string" && e.name.trim()) {
    parts.push(e.name.trim());
  }

  if (typeof e?.message === "string" && e.message.trim()) {
    parts.push(e.message.trim());
  }

  const status = e?.cause?.response?.status ?? e?.response?.status;
  const code = e?.cause?.code ?? e?.code;
  if (typeof status === "number" || typeof code === "string") {
    const extras: string[] = [];
    if (typeof status === "number") extras.push(`status=${status}`);
    if (typeof code === "string" && code.trim()) extras.push(`code=${code}`);
    if (extras.length) parts.push(extras.join(" "));
  }

  const metadata = e?.metadata;
  if (
    metadata &&
    typeof metadata === "object" &&
    Object.keys(metadata).length
  ) {
    try {
      parts.push(`metadata=${JSON.stringify(metadata)}`);
    } catch {
      parts.push("metadata=[unserializable]");
    }
  }

  if (parts.length) {
    return parts.join(" | ");
  }

  if (typeof e?.message === "string" && e.message.trim()) {
    return e.message;
  }
  if (typeof e === "string" && e.trim()) {
    return e;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

function hasJsonValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === (Prisma as any).DbNull) return false;
  if (value === (Prisma as any).JsonNull) return false;
  return true;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const ms =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? Math.max(1, Math.floor(timeoutMs))
      : 1;

  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          const err: any = new Error("Falha ao consultar LRCLIB");
          err.name = "TimeoutError";
          err.code = "ETIMEDOUT";
          err.metadata = { timeout_ms: ms };
          reject(err);
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function downloadAudioToTempFile(input: {
  url: string;
  tmpPath: string;
  maxBytes: number;
}): Promise<{
  file_size: number;
  content_type: string | null;
  original_filename: string;
}> {
  const downloadTimeoutRaw = Number(
    process.env.AI_CIFRA_PRELOAD_AUDIO_DOWNLOAD_TIMEOUT_MS ?? 120_000,
  );
  const downloadTimeoutMs =
    Number.isFinite(downloadTimeoutRaw) && downloadTimeoutRaw > 0
      ? Math.max(1, Math.floor(downloadTimeoutRaw))
      : 120_000;

  // Baixa em blocos com Range em vez de um GET único.
  //
  // O YouTube estrangula a taxa POR REQUISIÇÃO quando o cliente puxa o corpo
  // inteiro de uma vez: medido em 32 KB/s contra 4,78 MiB/s do próprio yt-dlp
  // na MESMA URL (~150x). Com o timeout padrão de 120s, um áudio de 4,8 MB nem
  // terminava — o download morria com ERR_CANCELED e a faixa era perdida.
  // Cada Range é uma requisição nova e o estrangulamento reinicia, que é
  // exatamente o truque do yt-dlp. Mantém a função genérica: serve para
  // qualquer candidato do resolver, não só os resolvidos por yt-dlp.
  const chunkRaw = Number(
    process.env.AI_CIFRA_PRELOAD_AUDIO_CHUNK_BYTES ?? 4 * 1024 * 1024,
  );
  const chunkBytes =
    Number.isFinite(chunkRaw) && chunkRaw > 0
      ? Math.max(64 * 1024, Math.floor(chunkRaw))
      : 4 * 1024 * 1024;

  const urlObj = new URL(input.url);
  const urlName = urlObj.pathname.split("/").filter(Boolean).pop();
  const originalFilename = urlName && urlName.length > 0 ? urlName : "audio";
  const sizeError = new Error("AI cifra audio file exceeds max size");

  let contentType: string | null = null;
  let totalBytes = 0;
  let totalSize: number | null = null;

  const handle = await fs.open(input.tmpPath, "w");
  try {
    for (;;) {
      const rangeEnd = totalBytes + chunkBytes - 1;
      const response = await axios.get(input.url, {
        responseType: "arraybuffer",
        // Timeout POR BLOCO: um bloco travado é reconhecido rápido, em vez de
        // consumir o orçamento inteiro do download.
        timeout: downloadTimeoutMs,
        maxRedirects: 5,
        headers: { Range: `bytes=${totalBytes}-${rangeEnd}` },
        validateStatus: (status) => status === 200 || status === 206,
      });

      if (contentType === null) {
        const raw = response.headers?.["content-type"];
        contentType =
          typeof raw === "string" ? raw.split(";")[0]?.trim() || null : null;
      }

      const buffer = Buffer.from(response.data as ArrayBuffer);

      // 200 = servidor ignorou o Range e mandou tudo. Grava e encerra: sem
      // suporte a Range não há o que fatiar.
      if (response.status === 200) {
        if (buffer.length > input.maxBytes) throw sizeError;
        await handle.write(buffer, 0, buffer.length, 0);
        totalBytes = buffer.length;
        break;
      }

      if (totalSize === null) {
        const contentRange = response.headers?.["content-range"];
        const match =
          typeof contentRange === "string"
            ? /\/(\d+)\s*$/.exec(contentRange)
            : null;
        if (match) totalSize = Number(match[1]);
        if (totalSize !== null && totalSize > input.maxBytes) throw sizeError;
      }

      if (buffer.length > 0) {
        await handle.write(buffer, 0, buffer.length, totalBytes);
        totalBytes += buffer.length;
        if (totalBytes > input.maxBytes) throw sizeError;
      }

      // Fim: servidor sinalizou o tamanho e chegamos nele, ou o bloco veio
      // menor que o pedido (última fatia), ou veio vazio.
      if (buffer.length === 0) break;
      if (totalSize !== null && totalBytes >= totalSize) break;
      if (buffer.length < chunkBytes) break;
    }
  } finally {
    await handle.close();
  }

  return {
    file_size: totalBytes,
    content_type: contentType,
    original_filename: originalFilename,
  };
}

function scorePlaylistTitle(title: string, mode: "br" | "global") {
  const t = title.normalize("NFKD").toLowerCase();
  let score = 0;
  if (t.includes("top")) score += 2;
  if (t.includes("100")) score += 3;
  if (t.includes("billboard")) score += 3;
  if (t.includes("hot")) score += 1;
  if (t.includes("chart") || t.includes("charts")) score += 1;
  const currentYear = new Date().getFullYear();
  if (t.includes(String(currentYear))) score += 4;
  if (t.includes(String(currentYear - 1))) score += 3;
  if (t.includes(String(currentYear - 2))) score += 2;
  if (t.includes(String(currentYear - 3))) score += 1;
  if (mode === "br") {
    if (t.includes("brasil") || t.includes("brazil") || /\bbr\b/.test(t))
      score += 4;
  } else {
    if (
      t.includes("global") ||
      t.includes("world") ||
      t.includes("mundial") ||
      t.includes("mundo")
    ) {
      score += 4;
    }
  }
  return score;
}

function normalizeForCompare(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOnlyTrackQuery(value: string): {
  artist: string | null;
  title: string;
  raw: string;
  normalized_artist: string | null;
  normalized_title: string;
  normalized_raw: string;
} {
  const raw = String(value ?? "").trim();
  const parts = raw.split(/\s+-\s+/u).map((s) => s.trim());
  const hasArtistTitle =
    parts.length >= 2 && parts[0] && parts.slice(1).join(" - ");
  const artist = hasArtistTitle ? parts[0] : null;
  const title = hasArtistTitle ? parts.slice(1).join(" - ") : raw;

  const normalized_artist = artist ? normalizeForCompare(artist) : null;
  const normalized_title = normalizeForCompare(title);
  const normalized_raw = normalizeForCompare(raw);
  return {
    artist,
    title,
    raw,
    normalized_artist,
    normalized_title,
    normalized_raw,
  };
}

function scoreTrackMatch(
  item: { title: string; artist: string },
  query: ReturnType<typeof parseOnlyTrackQuery>,
): number {
  const normalizedTitle = normalizeForCompare(item.title);
  const normalizedArtist = normalizeForCompare(item.artist);

  let score = 0;

  if (query.normalized_artist) {
    if (normalizedArtist === query.normalized_artist) score += 10;
    else if (normalizedArtist.includes(query.normalized_artist)) score += 6;
    else if (query.normalized_artist.includes(normalizedArtist)) score += 4;
    else score -= 5;
  }

  if (query.normalized_title) {
    if (normalizedTitle === query.normalized_title) score += 10;
    else if (normalizedTitle.includes(query.normalized_title)) score += 7;
    else if (query.normalized_title.includes(normalizedTitle)) score += 5;
    else score -= 8;
  }

  if (query.normalized_raw) {
    const combined = `${normalizedArtist} ${normalizedTitle}`.trim();
    if (combined.includes(query.normalized_raw)) score += 4;
    if (query.normalized_raw.includes(combined)) score += 2;
  }

  return score;
}

function stripTrailingDecorations(value: string): string {
  let out = String(value ?? "").trim();
  for (let i = 0; i < 4; i++) {
    const next = out
      .replace(/\s*[\[(][^\])]{0,200}[\])]\s*$/u, "")
      .replace(/\s*[|•].{0,80}$/u, "")
      .trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function cleanArtistName(value: string): string {
  const raw = stripTrailingDecorations(value);
  const normalized = raw
    .replace(
      /\b(official|oficial|topic|vevo|records|record|label|music|canal)\b/giu,
      " ",
    )
    .replace(/\s+-\s+topic\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || raw;
}

function normalizeCatalogTrack(input: { title: string; artist: string }): {
  title: string;
  artist: string;
} {
  const rawTitle = stripTrailingDecorations(input.title);
  const rawArtist = cleanArtistName(input.artist);

  const title = rawTitle
    .replace(/^[\s,;:|•\-–—]+/u, " ")
    .replace(/\s+/g, " ")
    .trim();
  const artist = rawArtist.replace(/\s+/g, " ").trim();

  const titleForCompare = title
    .replace(/\s+(?:feat\.?|ft\.?|part\.?|participa(?:cao|ção)?)\b.+$/iu, "")
    .trim();
  const titleN = normalizeForCompare(titleForCompare);
  const artistN = normalizeForCompare(artist);

  if (!titleN || !artistN) {
    return { title: title || rawTitle, artist: artist || rawArtist };
  }

  const separators = [" - ", " – ", " — ", " : "];
  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx <= 0) continue;
    const left = title.slice(0, idx).trim();
    const right = title.slice(idx + sep.length).trim();
    if (!left || !right) continue;
    const leftN = normalizeForCompare(left);
    const rightN = normalizeForCompare(right);

    const leftLooksLikeArtists =
      /[,&]/u.test(left) ||
      /\b(feat\.?|ft\.?|part\.?|participa(?:cao|ção)?|with)\b/iu.test(left);
    const rightLooksLikeArtists =
      /[,&]/u.test(right) ||
      /\b(feat\.?|ft\.?|part\.?|participa(?:cao|ção)?|with)\b/iu.test(right);

    const leftMatchesArtist =
      leftN === artistN ||
      (leftN.startsWith(artistN) &&
        Math.abs(leftN.length - artistN.length) <= 12) ||
      (artistN.startsWith(leftN) &&
        Math.abs(leftN.length - artistN.length) <= 12);
    const rightMatchesArtist =
      rightN === artistN ||
      (rightN.startsWith(artistN) &&
        Math.abs(rightN.length - artistN.length) <= 12) ||
      (artistN.startsWith(rightN) &&
        Math.abs(rightN.length - artistN.length) <= 12);

    if (leftMatchesArtist) {
      const nextArtist = leftLooksLikeArtists ? cleanArtistName(left) : artist;
      return { title: stripTrailingDecorations(right), artist: nextArtist };
    }
    if (rightMatchesArtist) {
      const nextArtist = rightLooksLikeArtists
        ? cleanArtistName(right)
        : artist;
      return { title: stripTrailingDecorations(left), artist: nextArtist };
    }

    if (leftLooksLikeArtists && !rightLooksLikeArtists) {
      const nextTitle = stripTrailingDecorations(right);
      if (!nextTitle) continue;

      const artistAlreadyIncluded =
        leftN.includes(artistN) || artistN.includes(leftN);

      const nextArtist = artistAlreadyIncluded
        ? cleanArtistName(left)
        : `${artist} feat. ${left}`.replace(/\s+/g, " ").trim();

      return {
        title: nextTitle,
        artist: nextArtist || artist,
      };
    }
  }

  if (titleN.startsWith(`${artistN} `)) {
    const trimmed = title.slice(artist.length).trim();
    if (trimmed) return { title: stripTrailingDecorations(trimmed), artist };
  }

  return { title, artist };
}

function isLikelySingleTrack(input: {
  title: string;
  artist: string;
}): boolean {
  const title = normalizeForCompare(input.title);
  const artist = normalizeForCompare(input.artist);

  if (!title) return false;
  if (title.length > 140) return false;

  const badTitlePatterns: RegExp[] = [
    /\btop\b/u,
    /\bcharts?\b/u,
    /\bhits\b/u,
    /\bplaylist\b/u,
    /\bmix\b/u,
    /\bcompilation\b/u,
    /\bfull\s+album\b/u,
    /\bao\s+vivo\b/u,
    /\blive\b/u,
    /\bcover\b/u,
    /\bkaraoke\b/u,
    /\bremix\b/u,
    /\binstrumental\b/u,
    /\bsped\s*up\b/u,
    /\bslowed\b/u,
    /\bmais\s+tocadas\b/u,
    /\bmais\s+ouvidas\b/u,
    /\btop\s*\d+\b/u,
    /\b\d+\s+(?:songs?|musics?)\b/u,
    /\b202[5-9]\b/u,
  ];

  const badArtistPatterns: RegExp[] = [
    /\bcharts?\b/u,
    /\btop\b/u,
    /\bhits\b/u,
    /\bplaylist\b/u,
    /\bmix\b/u,
    /\bpopnable\b/u,
    /\bglobal\s+charts?\b/u,
  ];

  if (badTitlePatterns.some((p) => p.test(title))) return false;
  if (artist && badArtistPatterns.some((p) => p.test(artist))) return false;

  return true;
}

async function collectCatalogItems(input: {
  client: MusifyPipedCatalogClient;
  sources: Array<
    | { kind: "playlist"; playlist_id: string }
    | { kind: "trending"; region: string }
  >;
  limit: number;
}): Promise<MusifyCatalogStreamItem[]> {
  const dedupe = new Set<string>();
  const out: MusifyCatalogStreamItem[] = [];

  for (const source of input.sources) {
    if (out.length >= input.limit) break;
    const remaining = input.limit - out.length;
    const batchLimit = Math.min(remaining, 250);
    const batch =
      source.kind === "playlist"
        ? await input.client.getPlaylistItems({
            playlistId: source.playlist_id,
            limit: batchLimit,
          })
        : await input.client.getTrending({
            region: source.region,
            limit: batchLimit,
          });

    for (const i of batch) {
      if (out.length >= input.limit) break;
      if (dedupe.has(i.youtube_video_id)) continue;
      dedupe.add(i.youtube_video_id);
      out.push(i);
    }
  }

  return out;
}

async function bootstrap() {
  const args = parseArgs(process.argv.slice(2));

  if (
    args.playlist_id &&
    args.limit === 100 &&
    args.catalog_limit === 500 &&
    !args.only_track
  ) {
    args.catalog_limit = 5000;
    args.limit = 5000;
  }

  args.limit = Math.max(1, Math.min(5000, Math.floor(args.limit)));
  args.catalog_limit = Math.max(args.limit, Math.min(5000, args.catalog_limit));

  const baseURL = (process.env.AI_CIFRA_MUSIFY_PIPED_BASE_URL ?? "").trim();
  const timeoutMs = Number(
    process.env.AI_CIFRA_MUSIFY_PIPED_TIMEOUT_MS ?? 10_000,
  );
  const client = MusifyPipedCatalogClient.create({
    baseURL,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 10_000,
  });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  await app.init();

  const prisma = app.get(PrismaService);
  const syncLyricsUseCase = app.get(SyncSyncedLyricsForMusicLibraryUseCase);
  const resolveCandidatesUseCase = app.get(
    ResolveAiCifraAudioCandidatesUseCase,
  );
  const createUploadUseCase = app.get(CreateAiCifraUploadUseCase);
  const requestAnalysisUseCase = app.get(RequestAiCifraAnalysisUseCase);
  const getJobUseCase = app.get(GetAiCifraAnalysisJobUseCase);
  const materializeChordSheetsUseCase = app.get(MaterializeChordSheetsUseCase);
  const materializeRenderableChordSheetsUseCase = app.get(
    MaterializeRenderableChordSheetsUseCase,
  );

  const resolvedMusicianId =
    args.musician_id ||
    (await prisma.musician
      .findFirst({ select: { id: true }, orderBy: { created_at: "asc" } })
      .then((m) => m?.id ?? null)) ||
    randomUUID();

  await prisma.musician.upsert({
    where: { id: resolvedMusicianId },
    update: {},
    create: {
      id: resolvedMusicianId,
      email: `musify-top100+${resolvedMusicianId}@soundmeet.local`,
      name: "Musify Top 100 Import",
    },
  });

  const sources: Array<
    | { kind: "playlist"; playlist_id: string }
    | { kind: "trending"; region: string }
  > = [];
  const pushPlaylist = (playlist_id: string) => {
    if (
      sources.some(
        (s) => s.kind === "playlist" && s.playlist_id === playlist_id,
      )
    ) {
      return;
    }
    sources.push({ kind: "playlist", playlist_id });
  };

  let foundBrPlaylists: any[] = [];
  let foundGlobalPlaylists: any[] = [];

  if (args.playlist_id) {
    pushPlaylist(args.playlist_id);
  } else {
    const isBrazilRegion = args.region.trim().toUpperCase() === "BR";
    const isBrazilPlaylist = (title: string) => {
      const t = normalizeForCompare(title);
      return t.includes("brasil") || t.includes("brazil") || /\bbr\b/u.test(t);
    };

    const brQueries = [
      args.playlist_query_br,
      "Mais tocadas 2024",
      "Mais tocadas 2023",
      "Top 50 Brasil",
      "Top 50 Brazil",
      "Top 100 Brasil 2024",
      "Top 100 Brasil 2023",
      "Top 100 Brasil",
      "Top 100 Brazil",
      "Brasil Top 100",
    ];
    const globalQueries = [
      args.playlist_query_global,
      "Billboard Hot 100 2024",
      "Billboard Hot 100 2023",
      "Top 100 Songs 2024",
      "Top 100 Songs 2023",
      "Billboard Hot 100",
      "Top 100 Global",
      "Top 100 Songs",
    ];

    // .catch por query (mesma proteção que searchPlaylistsItems/searchVideos já
    // tinham): as instâncias Piped públicas caem e rate-limitam o tempo todo, e
    // sem isto uma única query com erro derrubava o processo inteiro — nada de
    // cifra, mesmo com as outras 19 queries respondendo normalmente.
    foundBrPlaylists = (
      await Promise.all(
        brQueries.map((query) =>
          client
            .searchPlaylists({ query, limit: args.playlists_limit })
            .catch(() => []),
        ),
      )
    )
      .flat()
      .filter(
        (p, idx, arr) =>
          arr.findIndex((x) => x.playlist_id === p.playlist_id) === idx,
      );

    foundGlobalPlaylists = (
      await Promise.all(
        globalQueries.map((query) =>
          client
            .searchPlaylists({ query, limit: args.playlists_limit })
            .catch(() => []),
        ),
      )
    )
      .flat()
      .filter(
        (p, idx, arr) =>
          arr.findIndex((x) => x.playlist_id === p.playlist_id) === idx,
      );

    const bestBrPlaylists = [...foundBrPlaylists]
      .map((p) => ({ p, score: scorePlaylistTitle(p.title, "br") }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(10, args.playlists_limit))
      .map((x) => x.p);

    const bestGlobalPlaylists = [...foundGlobalPlaylists]
      .map((p) => ({ p, score: scorePlaylistTitle(p.title, "global") }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(10, args.playlists_limit))
      .map((x) => x.p);

    if (isBrazilRegion) {
      const brOnlyPlaylists = bestBrPlaylists.filter((p) =>
        isBrazilPlaylist(p.title),
      );
      for (const p of brOnlyPlaylists) pushPlaylist(p.playlist_id);
      sources.push({ kind: "trending", region: "BR" });
    } else {
      const hasBrPlaylists = bestBrPlaylists.length > 0;

      if (hasBrPlaylists) {
        for (const p of bestBrPlaylists) pushPlaylist(p.playlist_id);
        sources.push({ kind: "trending", region: args.region });

        for (const p of bestGlobalPlaylists) pushPlaylist(p.playlist_id);
        if (args.region !== "US") {
          sources.push({ kind: "trending", region: "US" });
        }
      } else {
        for (const p of bestGlobalPlaylists) pushPlaylist(p.playlist_id);
        if (args.region !== "US") {
          sources.push({ kind: "trending", region: "US" });
        }
        sources.push({ kind: "trending", region: args.region });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        status: "musify_playlists_discovery",
        baseURL,
        musician_id: resolvedMusicianId,
        playlist_id: args.playlist_id,
        query_br: args.playlist_query_br,
        playlists_br: foundBrPlaylists,
        query_global: args.playlist_query_global,
        playlists_global: foundGlobalPlaylists,
        selected_sources: sources,
        fallback_trending_region: args.region,
        limit: args.limit,
        catalog_limit: args.catalog_limit,
        force: args.force,
        dry_run: args.dry_run,
      },
      null,
      2,
    ),
  );

  const items = await collectCatalogItems({
    client,
    sources,
    limit: args.catalog_limit,
  });

  const query = args.only_track ? parseOnlyTrackQuery(args.only_track) : null;
  const extraPlaylistItems = query
    ? await client
        .searchPlaylistsItems({
          query: query.raw,
          playlistsLimit: args.playlists_limit,
          limit: args.catalog_limit,
        })
        .catch(() => [])
    : [];
  const extraVideoItems = query
    ? await client
        .searchVideos({
          query: query.raw,
          limit: Math.min(50, args.catalog_limit),
        })
        .catch(() => [])
    : [];

  const mergedItems: MusifyCatalogStreamItem[] = [];
  const mergedDedupe = new Set<string>();
  for (const it of [...items, ...extraPlaylistItems, ...extraVideoItems]) {
    if (!it.youtube_video_id || mergedDedupe.has(it.youtube_video_id)) continue;
    mergedDedupe.add(it.youtube_video_id);
    mergedItems.push(it);
  }

  const filteredItems = mergedItems.filter((i) =>
    isLikelySingleTrack({ title: i.title, artist: i.artist }),
  );

  const selectedItems = query
    ? [...filteredItems]
        .map((i) => ({ i, score: scoreTrackMatch(i, query) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 1)
        .map((x) => x.i)
    : filteredItems;

  console.log(
    JSON.stringify(
      {
        status: "musify_catalog_selected",
        items_total: mergedItems.length,
        items_filtered: filteredItems.length,
        ...(query
          ? {
              only_track: query.raw,
              matched: selectedItems.length > 0,
              matched_track: selectedItems[0]
                ? {
                    title: selectedItems[0].title,
                    artist: selectedItems[0].artist,
                    youtube_video_id: selectedItems[0].youtube_video_id,
                  }
                : null,
            }
          : {}),
        sources,
      },
      null,
      2,
    ),
  );

  if (args.dry_run) {
    await app.close();
    return;
  }

  if (query && selectedItems.length === 0) {
    await app.close();
    return;
  }

  const libraries: Array<{
    music_library_id: string;
    musician_id: string;
    title: string;
    artist: string;
    youtube_video_id: string;
    has_lrc: boolean;
    has_chords: boolean;
  }> = [];

  for (const item of selectedItems) {
    const normalized = normalizeCatalogTrack({
      title: item.title,
      artist: item.artist,
    });
    const existing = await prisma.musicLibrary.findFirst({
      where: {
        musicianId: resolvedMusicianId,
        source: "youtube",
        sourceId: item.youtube_video_id,
      },
      select: {
        id: true,
        title: true,
        artist: true,
        lrc_normalized: true,
        chords: true,
      },
    });

    const lib = existing
      ? { id: existing.id, title: existing.title, artist: existing.artist }
      : await prisma.musicLibrary.create({
          data: {
            musicianId: resolvedMusicianId,
            title: normalized.title,
            artist: normalized.artist,
            source: "youtube",
            sourceId: item.youtube_video_id,
          },
          select: { id: true, title: true, artist: true },
        });

    await prisma.musicLibrary.updateMany({
      where: {
        id: lib.id,
        musicianId: resolvedMusicianId,
      },
      data: {
        title: normalized.title,
        artist: normalized.artist,
        source: "youtube",
        sourceId: item.youtube_video_id,
      },
    });

    const current = await prisma.musicLibrary.findUnique({
      where: { id: lib.id },
      select: { lrc_normalized: true, chords: true },
    });

    libraries.push({
      music_library_id: lib.id,
      musician_id: resolvedMusicianId,
      title: normalized.title,
      artist: normalized.artist,
      youtube_video_id: item.youtube_video_id,
      has_lrc: hasJsonValue(current?.lrc_normalized),
      has_chords: hasJsonValue(current?.chords),
    });
  }

  console.log(
    JSON.stringify(
      {
        status: "music_library_ready",
        musician_id: resolvedMusicianId,
        items: libraries.length,
      },
      null,
      2,
    ),
  );

  const MAX_FILE_SIZE_BYTES = Number(
    process.env.AI_CIFRA_MAX_FILE_SIZE ?? 70 * 1024 * 1024,
  );

  let totalLyricsSynced = 0;
  let totalLyricsFailed = 0;

  const lyricsSuccess: Array<{
    music_library_id: string;
    musician_id: string;
    title: string;
    artist: string;
    provider: string | null;
    hash: string | null;
  }> = [];

  const lyricsFailed: Array<{
    music_library_id: string;
    musician_id: string;
    title: string;
    artist: string;
    error: string;
    error_code: "not_found" | "consult_error" | "unknown";
    retryable: boolean;
  }> = [];

  let totalAnalysisQueued = 0;
  let totalAnalysisCompleted = 0;
  let totalAnalysisFailed = 0;
  const analysisAttempted = new Set<string>();

  let itemsWithLrc = libraries.filter((i) => i.has_lrc).length;
  let itemsWithChords = libraries.filter((i) => i.has_chords).length;

  const lyricsCandidates = args.force
    ? libraries.slice(0, args.limit)
    : libraries.filter((i) => !i.has_lrc);

  for (const item of lyricsCandidates) {
    if (!args.force && itemsWithLrc >= args.limit) break;
    try {
      const out = await syncLyricsWithRetry(syncLyricsUseCase, {
        musician_id: item.musician_id,
        music_library_id: item.music_library_id,
        force: args.force,
      });
      totalLyricsSynced += 1;

      lyricsSuccess.push({
        music_library_id: item.music_library_id,
        musician_id: item.musician_id,
        title: item.title,
        artist: item.artist,
        provider:
          typeof out?.lrc_provider === "string" ? out.lrc_provider : null,
        hash: typeof out?.lrc_hash === "string" ? out.lrc_hash : null,
      });
    } catch (e: any) {
      totalLyricsFailed += 1;
      const notFound = isNotFoundLyricsError(e);
      const consultError =
        typeof e?.message === "string" &&
        e.message === "Falha ao consultar LRCLIB";
      const retryable = consultError && isTransientLrcLibError(e);

      lyricsFailed.push({
        music_library_id: item.music_library_id,
        musician_id: item.musician_id,
        title: item.title,
        artist: item.artist,
        error: formatError(e),
        error_code: notFound
          ? "not_found"
          : consultError
            ? "consult_error"
            : "unknown",
        retryable,
      });

      console.log(
        JSON.stringify(
          {
            status: "lyrics_sync_failed",
            music_library_id: item.music_library_id,
            musician_id: item.musician_id,
            title: item.title,
            artist: item.artist,
            error: formatError(e),
          },
          null,
          2,
        ),
      );
    }

    await sleep(250);

    const lib = await prisma.musicLibrary.findUnique({
      where: { id: item.music_library_id },
      select: { lrc_normalized: true },
    });
    item.has_lrc = hasJsonValue(lib?.lrc_normalized);
    if (item.has_lrc) {
      itemsWithLrc = Math.min(libraries.length, itemsWithLrc + 1);
      if (itemsWithLrc === args.limit || itemsWithLrc % 10 === 0) {
        console.log(
          JSON.stringify(
            {
              status: "lyrics_sync_progress",
              musician_id: item.musician_id,
              items_with_lrc: itemsWithLrc,
              target: args.limit,
            },
            null,
            2,
          ),
        );
      }
    }
  }

  itemsWithLrc = libraries.filter((i) => i.has_lrc).length;

  if (itemsWithChords < args.limit) {
    const concurrencyRaw = Number(
      process.env.AI_CIFRA_PRELOAD_ANALYSIS_CONCURRENCY ??
        process.env.AI_CIFRA_PROCESSING_CONCURRENCY ??
        2,
    );
    const analysisConcurrency =
      Number.isFinite(concurrencyRaw) && concurrencyRaw > 0
        ? Math.max(1, Math.min(6, Math.floor(concurrencyRaw)))
        : 2;

    while (itemsWithChords < args.limit) {
      const remainingNeeded = Math.max(0, args.limit - itemsWithChords);
      const analysisCandidates = libraries.filter(
        (i) =>
          i.has_lrc &&
          !i.has_chords &&
          (args.force || !analysisAttempted.has(i.music_library_id)),
      );
      if (!analysisCandidates.length) break;

      console.log(
        JSON.stringify(
          {
            status: "analysis_batch_start",
            musician_id: resolvedMusicianId,
            items_with_chords: itemsWithChords,
            target: args.limit,
            remaining_needed: remainingNeeded,
            candidates: analysisCandidates.length,
            concurrency: analysisConcurrency,
          },
          null,
          2,
        ),
      );

      const itemsToAnalyze = analysisCandidates.slice(0, remainingNeeded);
      for (const item of itemsToAnalyze) {
        analysisAttempted.add(item.music_library_id);
      }

      const queued = await runPool(
        itemsToAnalyze,
        analysisConcurrency,
        async (item) => {
          let resolved: Awaited<
            ReturnType<ResolveAiCifraAudioCandidatesUseCase["execute"]>
          >;
          try {
            resolved = await resolveCandidatesUseCase.execute({
              youtube_video_id: item.youtube_video_id,
            });
          } catch (e: any) {
            console.log(
              JSON.stringify(
                {
                  status: "analysis_failed_to_resolve_candidates",
                  music_library_id: item.music_library_id,
                  musician_id: item.musician_id,
                  title: item.title,
                  artist: item.artist,
                  youtube_video_id: item.youtube_video_id,
                  error: formatError(e),
                },
                null,
                2,
              ),
            );
            return { ok: false as const, kind: "resolve" as const, item };
          }

          const candidates = (resolved.candidates ?? []).map((c) => {
            return {
              audio_url: c.audio_url,
              content_type: c.content_type ?? undefined,
              original_filename: c.original_filename ?? undefined,
              source: c.source,
              source_id: c.source_id,
            };
          });

          if (!candidates.length) {
            console.log(
              JSON.stringify(
                {
                  status: "analysis_no_candidates",
                  music_library_id: item.music_library_id,
                  musician_id: item.musician_id,
                  title: item.title,
                  artist: item.artist,
                  youtube_video_id: item.youtube_video_id,
                },
                null,
                2,
              ),
            );
            return { ok: false as const, kind: "no_candidates" as const, item };
          }

          let lastErrorMessage = "Falha ao obter áudio a partir das fontes";
          let jobId: string | null = null;

          for (const candidate of candidates) {
            const tmpPath = join(
              tmpdir(),
              `${Date.now()}-${randomUUID()}-source.audio`,
            );

            try {
              const downloaded = await downloadAudioToTempFile({
                url: candidate.audio_url,
                tmpPath,
                maxBytes: MAX_FILE_SIZE_BYTES,
              });

              const contentType =
                candidate.content_type ??
                downloaded.content_type ??
                "audio/mpeg";
              const originalFilename =
                candidate.original_filename ?? downloaded.original_filename;

              const upload = await createUploadUseCase.execute({
                musician_id: item.musician_id,
                music_library_id: item.music_library_id,
                original_filename: originalFilename,
                content_type: contentType,
                file_size: downloaded.file_size,
                data: createReadStream(tmpPath),
              });

              if (
                typeof candidate.source === "string" &&
                candidate.source.trim()
              ) {
                await prisma.musicLibrary.updateMany({
                  where: {
                    id: item.music_library_id,
                    musicianId: item.musician_id,
                  },
                  data: {
                    source: candidate.source.trim(),
                    sourceId:
                      typeof candidate.source_id === "string" &&
                      candidate.source_id.trim()
                        ? candidate.source_id.trim()
                        : null,
                  },
                });
              }

              const job = await requestAnalysisUseCase.execute({
                ai_cifra_upload_id: upload.id,
                model_id: args.analysis_model_id ?? undefined,
              });

              jobId = job.id;

              console.log(
                JSON.stringify(
                  {
                    status: "analysis_queued",
                    music_library_id: item.music_library_id,
                    musician_id: item.musician_id,
                    title: item.title,
                    artist: item.artist,
                    youtube_video_id: item.youtube_video_id,
                    job_id: jobId,
                    provider: candidate.source,
                  },
                  null,
                  2,
                ),
              );
              break;
            } catch (e: any) {
              lastErrorMessage = formatError(e);
            } finally {
              await fs.unlink(tmpPath).catch(() => undefined);
            }
          }

          if (!jobId) {
            console.log(
              JSON.stringify(
                {
                  status: "analysis_failed_to_queue",
                  music_library_id: item.music_library_id,
                  musician_id: item.musician_id,
                  title: item.title,
                  artist: item.artist,
                  youtube_video_id: item.youtube_video_id,
                  error: lastErrorMessage,
                },
                null,
                2,
              ),
            );
            return {
              ok: false as const,
              kind: "queue" as const,
              item,
            };
          }

          return { ok: true as const, item, job_id: jobId };
        },
      );

      const jobs = queued.filter((r) => r.ok) as Array<{
        ok: true;
        item: (typeof libraries)[number];
        job_id: string;
      }>;

      totalAnalysisQueued += jobs.length;
      totalAnalysisFailed += queued.filter((r) => !r.ok).length;

      const completed = await runPool(
        jobs,
        analysisConcurrency,
        async (job) => {
          const deadline = Date.now() + args.analysis_max_wait_ms;
          let finalStatus: "completed" | "failed" | "timeout" = "timeout";
          let finalError: string | null = null;

          while (Date.now() < deadline) {
            try {
              const current = await getJobUseCase.execute({ id: job.job_id });
              if (current.status === "completed") {
                finalStatus = "completed";
                break;
              }
              if (current.status === "failed") {
                finalStatus = "failed";
                finalError =
                  current.error_message ??
                  current.error_code ??
                  "analysis_failed";
                break;
              }
            } catch (e: any) {
              finalStatus = "failed";
              finalError = formatError(e);
              break;
            }

            await sleep(args.analysis_poll_interval_ms);
          }

          if (finalStatus === "completed") {
            const lib = await prisma.musicLibrary.findUnique({
              where: { id: job.item.music_library_id },
              select: { chords: true },
            });
            const hasChords = hasJsonValue(lib?.chords);
            job.item.has_chords = hasChords;
            console.log(
              JSON.stringify(
                {
                  status: "analysis_completed",
                  music_library_id: job.item.music_library_id,
                  musician_id: job.item.musician_id,
                  title: job.item.title,
                  artist: job.item.artist,
                  has_chords: hasChords,
                  job_id: job.job_id,
                },
                null,
                2,
              ),
            );
            return {
              job_id: job.job_id,
              status: "completed" as const,
              has_chords: hasChords,
            };
          }

          console.log(
            JSON.stringify(
              {
                status: "analysis_failed",
                music_library_id: job.item.music_library_id,
                musician_id: job.item.musician_id,
                title: job.item.title,
                artist: job.item.artist,
                job_id: job.job_id,
                error: finalError ?? "analysis_timeout",
              },
              null,
              2,
            ),
          );

          return {
            job_id: job.job_id,
            status: "failed" as const,
            has_chords: false,
          };
        },
      );

      totalAnalysisCompleted += completed.filter(
        (c) => c.status === "completed",
      ).length;
      const failedNow = completed.filter(
        (c) => c.status !== "completed",
      ).length;
      totalAnalysisFailed += failedNow;

      itemsWithChords = libraries.filter((i) => i.has_chords).length;
      if (!args.force && itemsWithChords >= args.limit) break;
      if (jobs.length === 0) break;
    }
  }

  const eligibleIds = await prisma.musicLibrary
    .findMany({
      where: {
        id: { in: libraries.map((l) => l.music_library_id) },
        musicianId: resolvedMusicianId,
        lrc_normalized: { not: Prisma.DbNull },
        chords: { not: Prisma.DbNull },
        ...(args.force ? {} : { chord_sheet_version: 0 }),
      },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const eligibleRenderableIds = await prisma.musicLibrary
    .findMany({
      where: {
        id: { in: libraries.map((l) => l.music_library_id) },
        musicianId: resolvedMusicianId,
        lrc_normalized: { not: Prisma.DbNull },
        chords: { not: Prisma.DbNull },
        ...(args.force ? {} : { renderable_chord_sheet_version: 0 }),
      },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const libraryOrder = new Map(
    libraries.map((l, idx) => [l.music_library_id, idx] as const),
  );
  const sortedEligibleIds = [...eligibleIds].sort(
    (a, b) => (libraryOrder.get(a) ?? 0) - (libraryOrder.get(b) ?? 0),
  );
  const sortedEligibleRenderableIds = [...eligibleRenderableIds].sort(
    (a, b) => (libraryOrder.get(a) ?? 0) - (libraryOrder.get(b) ?? 0),
  );

  const limitedEligibleIds = sortedEligibleIds.slice(0, args.limit);
  const limitedEligibleRenderableIds = sortedEligibleRenderableIds.slice(
    0,
    args.limit,
  );

  const chordSheetOut =
    limitedEligibleIds.length > 0
      ? await materializeChordSheetsUseCase.execute({
          musician_id: resolvedMusicianId,
          music_library_ids: limitedEligibleIds,
          force: args.force,
        })
      : { musician_id: resolvedMusicianId, items: [] as any[] };

  const renderableOut =
    limitedEligibleRenderableIds.length > 0
      ? await materializeRenderableChordSheetsUseCase.execute({
          musician_id: resolvedMusicianId,
          music_library_ids: limitedEligibleRenderableIds,
          force: args.force,
        })
      : { musician_id: resolvedMusicianId, items: [] as any[] };

  const baseUrlRaw = `${process.env.APP_URL ?? "http://localhost:3000"}`.trim();
  const baseUrl = baseUrlRaw.replace(/\/+$/u, "") || "http://localhost:3000";

  const renderableReadyIds = await prisma.musicLibrary
    .findMany({
      where: {
        id: { in: libraries.map((l) => l.music_library_id) },
        musicianId: resolvedMusicianId,
        renderable_chord_sheet_version: { gt: 0 },
      },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const renderableReady = new Set(renderableReadyIds);
  const html_urls = libraries
    .filter((l) => renderableReady.has(l.music_library_id))
    .map((l) => {
      const url = `${baseUrl}/api/v1/music-library/${encodeURIComponent(
        l.music_library_id,
      )}/chord-sheet/preview?musician_id=${encodeURIComponent(
        resolvedMusicianId,
      )}`;
      return {
        music_library_id: l.music_library_id,
        title: l.title,
        artist: l.artist,
        url,
      };
    });

  const summary = {
    status: "done",
    musician_id: resolvedMusicianId,
    total: libraries.length,
    lyrics: { synced: totalLyricsSynced, failed: totalLyricsFailed },
    lyrics_sync: {
      success: lyricsSuccess,
      failed: lyricsFailed,
    },
    analysis: {
      queued: totalAnalysisQueued,
      completed: totalAnalysisCompleted,
      failed: totalAnalysisFailed,
    },
    chord_sheet: {
      eligible: limitedEligibleIds.length,
      eligible_total: eligibleIds.length,
      materialized: chordSheetOut.items.filter(
        (i: any) => i.status === "materialized",
      ).length,
      skipped: chordSheetOut.items.filter((i: any) => i.status === "skipped")
        .length,
      failed: chordSheetOut.items.filter((i: any) => i.status === "failed")
        .length,
    },
    renderable_chord_sheet: {
      eligible: limitedEligibleRenderableIds.length,
      eligible_total: eligibleRenderableIds.length,
      materialized: renderableOut.items.filter(
        (i: any) => i.status === "materialized",
      ).length,
      skipped: renderableOut.items.filter((i: any) => i.status === "skipped")
        .length,
      failed: renderableOut.items.filter((i: any) => i.status === "failed")
        .length,
    },
    html_urls,
  };

  console.log(JSON.stringify(summary, null, 2));

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
