import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import axios from "axios";
import { randomUUID } from "crypto";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";

import { AppModule } from "../app.module";
import { CreateAiCifraUploadUseCase } from "../core/ai-cifra/application/use-cases/create-ai-cifra-upload/create-ai-cifra-upload.use-case";
import { GetAiCifraAnalysisJobUseCase } from "../core/ai-cifra/application/use-cases/get-ai-cifra-analysis-job/get-ai-cifra-analysis-job.use-case";
import { RequestAiCifraAnalysisUseCase } from "../core/ai-cifra/application/use-cases/request-ai-cifra-analysis/request-ai-cifra-analysis.use-case";
import { ResolveAiCifraAudioCandidatesUseCase } from "../core/ai-cifra/application/use-cases/resolve-ai-cifra-audio-candidates/resolve-ai-cifra-audio-candidates.use-case";
import { MaterializeChordSheetsUseCase } from "../core/synced-lyrics/application/use-cases/materialize-chord-sheets/materialize-chord-sheets.use-case";
import { SyncSyncedLyricsForMusicLibraryUseCase } from "../core/synced-lyrics/application/use-cases/sync-synced-lyrics-for-music-library/sync-synced-lyrics-for-music-library.use-case";
import { PrismaService } from "../nest-modules/database-module/prisma/prisma.service";

type CliArgs = {
  limit: number;
  track_take: number;
  status: string | null;
  ensure_chords: boolean;
  analysis_model_id: string | null;
  analysis_max_wait_ms: number;
  analysis_poll_interval_ms: number;
  force: boolean;
  dry_run: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    limit: 100,
    track_take: 500,
    status: "played",
    ensure_chords: true,
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

    if (key === "limit") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) args.limit = Math.floor(n);
      continue;
    }

    if (key === "track_take") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) args.track_take = Math.floor(n);
      continue;
    }

    if (key === "status") {
      args.status = value ? value : null;
      continue;
    }

    if (key === "ensure_chords") {
      args.ensure_chords = value ? value === "true" : true;
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

function normalizeTrackKey(title: string, artist: string) {
  return (
    `${artist}`.trim().toLowerCase() + "|" + `${title}`.trim().toLowerCase()
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function formatError(e: any): string {
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

async function downloadAudioToTempFile(input: {
  url: string;
  tmpPath: string;
  maxBytes: number;
}): Promise<{
  file_size: number;
  content_type: string | null;
  original_filename: string;
}> {
  const response = await axios.get(input.url, {
    responseType: "stream",
    timeout: 60_000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const rawContentType =
    typeof response.headers?.["content-type"] === "string"
      ? response.headers["content-type"]
      : null;
  const contentType = rawContentType
    ? rawContentType.split(";")[0]?.trim() || null
    : null;

  const urlObj = new URL(input.url);
  const urlName = urlObj.pathname.split("/").filter(Boolean).pop();
  const originalFilename = urlName && urlName.length > 0 ? urlName : "audio";

  const stream = response.data as unknown as Readable;
  const writer = createWriteStream(input.tmpPath);

  let totalBytes = 0;
  const sizeError = new Error("AI cifra audio file exceeds max size");

  await new Promise<void>((resolve, reject) => {
    writer.on("error", (err) => {
      stream.destroy();
      reject(err);
    });
    stream.on("error", (err) => {
      writer.destroy();
      reject(err);
    });
    stream.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > input.maxBytes) {
        stream.destroy(sizeError);
      }
    });
    writer.on("finish", resolve);
    stream.pipe(writer);
  });

  return {
    file_size: totalBytes,
    content_type: contentType,
    original_filename: originalFilename,
  };
}

async function bootstrap() {
  const args = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  await app.init();

  const prisma = app.get(PrismaService);
  const useCase = app.get(MaterializeChordSheetsUseCase);
  const syncLyricsUseCase = app.get(SyncSyncedLyricsForMusicLibraryUseCase);
  const resolveCandidatesUseCase = app.get(
    ResolveAiCifraAudioCandidatesUseCase,
  );
  const createUploadUseCase = app.get(CreateAiCifraUploadUseCase);
  const requestAnalysisUseCase = app.get(RequestAiCifraAnalysisUseCase);
  const getJobUseCase = app.get(GetAiCifraAnalysisJobUseCase);

  const whereRequest: any = args.status ? { status: args.status } : {};

  const tracks = await prisma.musicRequest.groupBy({
    by: ["songTitle", "artistName"],
    where: whereRequest,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: args.track_take,
  });

  const selected = new Map<
    string,
    {
      music_library_id: string;
      musician_id: string;
      title: string;
      artist: string;
      has_lrc: boolean;
      has_chords: boolean;
      source: string | null;
      source_id: string | null;
    }
  >();

  for (const t of tracks) {
    if (selected.size >= args.limit) break;

    const title = `${(t as any).songTitle ?? ""}`.trim();
    const artist = `${(t as any).artistName ?? ""}`.trim();
    if (!title || !artist) continue;

    const key = normalizeTrackKey(title, artist);
    if (selected.has(key)) continue;

    const library = await prisma.musicLibrary.findFirst({
      where: {
        title: { equals: title, mode: "insensitive" },
        artist: { equals: artist, mode: "insensitive" },
        ...(args.ensure_chords
          ? {
              OR: [
                { chords: { not: Prisma.DbNull } },
                { source: "youtube", sourceId: { not: null } },
              ],
            }
          : { chords: { not: Prisma.DbNull } }),
        ...(args.force ? {} : { chord_sheet_version: 0 }),
      },
      select: {
        id: true,
        musicianId: true,
        title: true,
        artist: true,
        lrc_normalized: true,
        chords: true,
        source: true,
        sourceId: true,
      },
      orderBy: { updated_at: "desc" },
    });

    if (!library) continue;

    selected.set(key, {
      music_library_id: library.id,
      musician_id: library.musicianId,
      title: library.title,
      artist: library.artist,
      has_lrc: hasJsonValue(library.lrc_normalized),
      has_chords: hasJsonValue(library.chords),
      source: library.source ?? null,
      source_id: library.sourceId ?? null,
    });
  }

  if (selected.size === 0) {
    const libraries = await prisma.musicLibrary.findMany({
      where: {
        ...(args.ensure_chords
          ? {
              OR: [
                { chords: { not: Prisma.DbNull } },
                { source: "youtube", sourceId: { not: null } },
              ],
            }
          : { chords: { not: Prisma.DbNull } }),
        ...(args.force ? {} : { chord_sheet_version: 0 }),
      },
      select: {
        id: true,
        musicianId: true,
        title: true,
        artist: true,
        lrc_normalized: true,
        chords: true,
        source: true,
        sourceId: true,
      },
      orderBy: { updated_at: "desc" },
      take: Math.max(args.track_take, args.limit),
    });

    for (const lib of libraries) {
      if (selected.size >= args.limit) break;
      const key = normalizeTrackKey(lib.title, lib.artist);
      if (selected.has(key)) continue;
      selected.set(key, {
        music_library_id: lib.id,
        musician_id: lib.musicianId,
        title: lib.title,
        artist: lib.artist,
        has_lrc: hasJsonValue(lib.lrc_normalized),
        has_chords: hasJsonValue(lib.chords),
        source: lib.source ?? null,
        source_id: lib.sourceId ?? null,
      });
    }
  }

  const selectedList = Array.from(selected.values());
  const byMusician = new Map<string, string[]>();
  for (const item of selectedList) {
    const list = byMusician.get(item.musician_id) ?? [];
    list.push(item.music_library_id);
    byMusician.set(item.musician_id, list);
  }

  console.log(
    JSON.stringify(
      {
        status: "selected",
        requested_status_filter: args.status,
        limit: args.limit,
        track_take: args.track_take,
        selected: selectedList.length,
        musicians: byMusician.size,
        ensure_chords: args.ensure_chords,
        analysis_model_id: args.analysis_model_id,
        analysis_max_wait_ms: args.analysis_max_wait_ms,
        analysis_poll_interval_ms: args.analysis_poll_interval_ms,
        force: args.force,
        dry_run: args.dry_run,
      },
      null,
      2,
    ),
  );

  if (args.dry_run) {
    await app.close();
    return;
  }

  const MAX_FILE_SIZE_BYTES = Number(
    process.env.AI_CIFRA_MAX_FILE_SIZE ?? 70 * 1024 * 1024,
  );

  let totalAnalysisQueued = 0;
  let totalAnalysisCompleted = 0;
  let totalAnalysisFailed = 0;

  let totalMaterialized = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  let totalLyricsSynced = 0;
  let totalLyricsFailed = 0;

  for (const item of selectedList) {
    if (item.has_lrc) {
      continue;
    }

    try {
      await syncLyricsUseCase.execute({
        musician_id: item.musician_id,
        music_library_id: item.music_library_id,
      });
      totalLyricsSynced += 1;
    } catch (e: any) {
      totalLyricsFailed += 1;
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

    const lib = await prisma.musicLibrary.findUnique({
      where: { id: item.music_library_id },
      select: { lrc_normalized: true },
    });
    item.has_lrc = hasJsonValue(lib?.lrc_normalized);
  }

  if (args.ensure_chords) {
    for (const item of selectedList) {
      if (item.has_chords) {
        continue;
      }

      if (item.source !== "youtube" || !item.source_id) {
        continue;
      }

      let resolved: Awaited<
        ReturnType<ResolveAiCifraAudioCandidatesUseCase["execute"]>
      >;
      try {
        resolved = await resolveCandidatesUseCase.execute({
          youtube_video_id: item.source_id,
        });
      } catch (e: any) {
        totalAnalysisFailed += 1;
        console.log(
          JSON.stringify(
            {
              status: "analysis_failed_to_resolve_candidates",
              music_library_id: item.music_library_id,
              musician_id: item.musician_id,
              title: item.title,
              artist: item.artist,
              source: item.source,
              source_id: item.source_id,
              error: formatError(e),
            },
            null,
            2,
          ),
        );
        continue;
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
        totalAnalysisFailed += 1;
        console.log(
          JSON.stringify(
            {
              status: "analysis_no_candidates",
              music_library_id: item.music_library_id,
              musician_id: item.musician_id,
              title: item.title,
              artist: item.artist,
              source: item.source,
              source_id: item.source_id,
            },
            null,
            2,
          ),
        );
        continue;
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
            candidate.content_type ?? downloaded.content_type ?? "audio/mpeg";
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

          if (typeof candidate.source === "string" && candidate.source.trim()) {
            await prisma.musicLibrary.updateMany({
              where: {
                id: item.music_library_id,
                musicianId: item.musician_id,
              },
              data: {
                source: candidate.source.trim(),
                sourceId:
                  typeof candidate.source_id === "string" &&
                  candidate.source_id.trim().length > 0
                    ? candidate.source_id.trim()
                    : null,
              },
            });
          }

          const job = await requestAnalysisUseCase.execute({
            ai_cifra_upload_id: upload.id,
            model_id: args.analysis_model_id ?? undefined,
          });

          totalAnalysisQueued += 1;
          jobId = job.id;
          break;
        } catch (e: any) {
          lastErrorMessage = formatError(e);
        } finally {
          await fs.unlink(tmpPath).catch(() => undefined);
        }
      }

      if (!jobId) {
        totalAnalysisFailed += 1;
        console.log(
          JSON.stringify(
            {
              status: "analysis_failed_to_queue",
              music_library_id: item.music_library_id,
              musician_id: item.musician_id,
              title: item.title,
              artist: item.artist,
              error: lastErrorMessage,
            },
            null,
            2,
          ),
        );
        continue;
      }

      const deadline = Date.now() + args.analysis_max_wait_ms;
      let finalStatus: string | null = null;
      let finalError: string | null = null;

      while (Date.now() < deadline) {
        try {
          const job = await getJobUseCase.execute({ id: jobId });
          if (job.status === "completed") {
            finalStatus = "completed";
            break;
          }
          if (job.status === "failed") {
            finalStatus = "failed";
            finalError =
              job.error_message ?? job.error_code ?? "analysis_failed";
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
        totalAnalysisCompleted += 1;
        const lib = await prisma.musicLibrary.findUnique({
          where: { id: item.music_library_id },
          select: { chords: true },
        });
        item.has_chords = hasJsonValue(lib?.chords);
        console.log(
          JSON.stringify(
            {
              status: "analysis_completed",
              music_library_id: item.music_library_id,
              musician_id: item.musician_id,
              title: item.title,
              artist: item.artist,
              has_chords: item.has_chords,
              job_id: jobId,
            },
            null,
            2,
          ),
        );
      } else {
        totalAnalysisFailed += 1;
        console.log(
          JSON.stringify(
            {
              status: "analysis_failed",
              music_library_id: item.music_library_id,
              musician_id: item.musician_id,
              title: item.title,
              artist: item.artist,
              job_id: jobId,
              error: finalError ?? "analysis_timeout",
            },
            null,
            2,
          ),
        );
      }
    }
  }

  for (const [musicianId, ids] of byMusician.entries()) {
    const eligibleIds = await prisma.musicLibrary
      .findMany({
        where: {
          id: { in: ids },
          musicianId,
          lrc_normalized: { not: Prisma.DbNull },
          chords: { not: Prisma.DbNull },
        },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));

    if (!eligibleIds.length) {
      console.log(
        JSON.stringify(
          {
            status: "batch_done",
            musician_id: musicianId,
            items: ids.length,
            eligible: 0,
            materialized: 0,
            skipped: 0,
            failed: 0,
          },
          null,
          2,
        ),
      );
      continue;
    }

    const output = await useCase.execute({
      musician_id: musicianId,
      music_library_ids: eligibleIds,
      force: args.force,
    });

    const materialized = output.items.filter(
      (i) => i.status === "materialized",
    ).length;
    const skipped = output.items.filter((i) => i.status === "skipped").length;
    const failed = output.items.filter((i) => i.status === "failed").length;

    totalMaterialized += materialized;
    totalSkipped += skipped;
    totalFailed += failed;

    console.log(
      JSON.stringify(
        {
          status: "batch_done",
          musician_id: musicianId,
          items: ids.length,
          eligible: eligibleIds.length,
          materialized,
          skipped,
          failed,
        },
        null,
        2,
      ),
    );
  }

  const persistedCount = await prisma.musicLibrary.count({
    where: {
      chord_sheet_version: { gt: 0 },
      chord_sheet: { not: Prisma.DbNull },
    },
  });

  console.log(
    JSON.stringify(
      {
        status: "done",
        total_selected: selectedList.length,
        total_lyrics_synced: totalLyricsSynced,
        total_lyrics_failed: totalLyricsFailed,
        total_analysis_queued: totalAnalysisQueued,
        total_analysis_completed: totalAnalysisCompleted,
        total_analysis_failed: totalAnalysisFailed,
        total_materialized: totalMaterialized,
        total_skipped: totalSkipped,
        total_failed: totalFailed,
        music_library_with_chord_sheet: persistedCount,
      },
      null,
      2,
    ),
  );

  await app.close();
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
