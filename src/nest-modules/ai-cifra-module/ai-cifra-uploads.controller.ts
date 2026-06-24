import {
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import axios from "axios";
import { isUUID } from "class-validator";
import { randomUUID } from "crypto";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { diskStorage } from "multer";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";

import { AiCifraAudioCandidate } from "../../core/ai-cifra/application/ports/ai-cifra-audio-candidates-resolver.interface";
import { CreateAiCifraUploadUseCase } from "../../core/ai-cifra/application/use-cases/create-ai-cifra-upload/create-ai-cifra-upload.use-case";
import { RequestAiCifraAnalysisUseCase } from "../../core/ai-cifra/application/use-cases/request-ai-cifra-analysis/request-ai-cifra-analysis.use-case";
import { ResolveAiCifraAudioCandidatesUseCase } from "../../core/ai-cifra/application/use-cases/resolve-ai-cifra-audio-candidates/resolve-ai-cifra-audio-candidates.use-case";
import { MusifyPipedCatalogClient } from "../../core/ai-cifra/infra/audio-sources/musify-piped.catalog-client";
import { Throttle } from "@nestjs/throttler";

import { AuthGuard, Roles, RolesGuard } from "../auth-module";
import { MusicLibraryCatalogService } from "../music-library-module/music-library.service";
import {
  AiCifraAnalysisJobPresenter,
  AiCifraUploadPresenter,
} from "./ai-cifra.presenter";
import { PreloadMusifyCatalogDto } from "./dto/preload-musify-catalog.dto";
import { PreloadPopularChordSheetsDto } from "./dto/preload-popular-chord-sheets.dto";
import { RequestAiCifraAnalysisFromProviderDto } from "./dto/request-ai-cifra-analysis-from-provider.dto";
import { RequestAiCifraAnalysisFromSourceDto } from "./dto/request-ai-cifra-analysis-from-source.dto";

const MAX_FILE_SIZE_BYTES = Number(
  process.env.AI_CIFRA_MAX_FILE_SIZE ?? 70 * 1024 * 1024,
);

@ApiTags("AI Cifra")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard)
@Roles("musician", "admin")
@Controller("musicians/:musician_id/ai-cifra/uploads")
export class AiCifraUploadsController {
  @Inject(CreateAiCifraUploadUseCase)
  private createUploadUseCase: CreateAiCifraUploadUseCase;

  @Inject(RequestAiCifraAnalysisUseCase)
  private requestAnalysisUseCase: RequestAiCifraAnalysisUseCase;

  @Inject(ResolveAiCifraAudioCandidatesUseCase)
  private resolveCandidatesUseCase: ResolveAiCifraAudioCandidatesUseCase;

  @Inject(MusicLibraryCatalogService)
  private musicLibraryCatalogService: MusicLibraryCatalogService;

  @Post()
  @ApiOperation({
    summary: "Upload de áudio (IA Cifra)",
    description:
      "Faz upload do áudio para o storage (Cloudflare R2/MinIO/S3) e cria o registro para análise de cifra.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: AiCifraUploadPresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          const safeName = (file.originalname || "file").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body("music_library_id") music_library_id: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const normalizedMusicLibraryId =
      typeof music_library_id === "string" && music_library_id.trim().length > 0
        ? music_library_id.trim()
        : undefined;

    if (normalizedMusicLibraryId && !isUUID(normalizedMusicLibraryId, "4")) {
      throw new UnprocessableEntityException("music_library_id must be a UUID");
    }

    const tmpPath = file?.path
      ? file.path
      : join(tmpdir(), `${Date.now()}-${randomUUID()}`);
    try {
      const output = await this.createUploadUseCase.execute({
        musician_id,
        music_library_id: normalizedMusicLibraryId ?? null,
        original_filename: file.originalname,
        content_type: file.mimetype,
        file_size: file.size,
        data: createReadStream(tmpPath),
      });
      return new AiCifraUploadPresenter(output);
    } finally {
      if (file?.path) {
        await fs.unlink(file.path).catch(() => undefined);
      }
    }
  }

  @Post("from-source/analyses")
  @ApiOperation({
    summary: "Solicitar análise de cifra a partir de fontes (fallback)",
    description:
      "Baixa o áudio temporariamente a partir de uma lista ordenada de URLs, faz upload para o storage apenas para processamento, e descarta o áudio após conclusão.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AiCifraAnalysisJobPresenter })
  async requestAnalysisFromSource(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: RequestAiCifraAnalysisFromSourceDto,
  ) {
    return this.requestAnalysisFromCandidates(musician_id, {
      music_library_id: dto.music_library_id,
      model_id: dto.model_id,
      candidates: dto.candidates,
    });
  }

  @Post("from-provider/analyses")
  @ApiOperation({
    summary: "Solicitar análise de cifra via SimpMusic (fallback Musify)",
    description:
      "Resolve URLs temporárias do áudio (SimpMusic/yt-dlp e fallback Musify/Piped), baixa temporariamente, faz upload apenas para processamento e descarta o áudio.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AiCifraAnalysisJobPresenter })
  async requestAnalysisFromProvider(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: RequestAiCifraAnalysisFromProviderDto,
  ) {
    const resolved = await this.resolveCandidatesUseCase.execute({
      youtube_video_id: dto.youtube_video_id,
    });

    const orderedCandidates =
      dto.provider === "musify"
        ? this.prioritizeCandidates(resolved.candidates, "musify")
        : resolved.candidates;

    if (!orderedCandidates.length) {
      throw new UnprocessableEntityException("No candidates resolved");
    }

    return this.requestAnalysisFromCandidates(musician_id, {
      music_library_id: dto.music_library_id,
      model_id: dto.model_id,
      candidates: orderedCandidates.map((c) => {
        return {
          audio_url: c.audio_url,
          content_type: c.content_type ?? undefined,
          original_filename: c.original_filename ?? undefined,
          source: c.source,
          source_id: c.source_id,
        };
      }),
    });
  }

  @Post("preload/musify/catalog/analyses")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: "Pré-carregar cifras a partir de playlist/top hits (Musify)",
    description:
      "Busca músicas no Musify/Piped (playlist ou trending), cria/reaproveita registros na MusicLibrary e dispara análises de cifra em lote.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201 })
  async preloadFromMusifyCatalog(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: PreloadMusifyCatalogDto,
  ) {
    const baseURL = process.env.AI_CIFRA_MUSIFY_PIPED_BASE_URL ?? null;
    if (!baseURL) {
      throw new UnprocessableEntityException(
        "AI_CIFRA_MUSIFY_PIPED_BASE_URL não configurado",
      );
    }

    const timeoutMs = Number(
      process.env.AI_CIFRA_MUSIFY_PIPED_TIMEOUT_MS ?? 10_000,
    );
    const client = MusifyPipedCatalogClient.create({
      baseURL,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 10_000,
    });

    const limit =
      typeof dto.limit === "number" && Number.isFinite(dto.limit)
        ? Math.max(1, Math.min(100, Math.floor(dto.limit)))
        : 25;

    const modelId = typeof dto.model_id === "string" ? dto.model_id : undefined;

    if (dto.source === "playlist" && !String(dto.playlist_id ?? "").trim()) {
      throw new UnprocessableEntityException("playlist_id é obrigatório");
    }

    const items =
      dto.source === "playlist"
        ? await client.getPlaylistItems({
            playlistId: String(dto.playlist_id ?? "").trim(),
            limit,
          })
        : dto.source === "search_playlists"
          ? await client.searchPlaylistsItems({
              query: String(dto.query ?? "Top Músicas Brasileiras").trim(),
              playlistsLimit:
                typeof dto.playlists_limit === "number" &&
                Number.isFinite(dto.playlists_limit)
                  ? Math.max(1, Math.min(20, Math.floor(dto.playlists_limit)))
                  : 3,
              limit,
            })
          : await client.getTrending({
              region: String(dto.region ?? "BR").trim() || "BR",
              limit,
            });

    const providerForPreload: "simpmusic" | "musify" =
      dto.source === "search_playlists"
        ? (dto.provider ?? "simpmusic")
        : "musify";

    const preloadItems = items.map((i) => {
      return {
        title: i.title,
        artist: i.artist,
        youtube_video_id: i.youtube_video_id,
        provider: providerForPreload,
        model_id: modelId,
      };
    });

    const results = await this.preloadChordSheets(musician_id, preloadItems);

    return {
      source: dto.source,
      region: dto.source === "trending" ? (dto.region ?? "BR") : undefined,
      playlist_id: dto.source === "playlist" ? dto.playlist_id : undefined,
      query: dto.source === "search_playlists" ? dto.query : undefined,
      playlists_limit:
        dto.source === "search_playlists" ? dto.playlists_limit : undefined,
      provider:
        dto.source === "search_playlists" ? providerForPreload : undefined,
      results,
    };
  }

  @Post("preload/popular/from-provider/analyses")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: "Pré-carregar folhas de cifra no banco (SimpMusic + fallback)",
    description:
      "Cria (ou reaproveita) registros na MusicLibrary e dispara análises de cifra via SimpMusic (fallback Musify).",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201 })
  async preloadPopularChordSheetsFromProvider(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: PreloadPopularChordSheetsDto,
  ) {
    const items = Array.isArray(dto?.items) ? dto.items : [];
    const results = await this.preloadChordSheets(musician_id, items);
    return { results };
  }

  private prioritizeCandidates(
    candidates: AiCifraAudioCandidate[],
    preferredProvider: string,
  ) {
    const preferred: AiCifraAudioCandidate[] = [];
    const rest: AiCifraAudioCandidate[] = [];
    for (const c of candidates ?? []) {
      if (c?.provider === preferredProvider) {
        preferred.push(c);
      } else {
        rest.push(c);
      }
    }
    return [...preferred, ...rest];
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return "Falha ao processar requisição";
  }

  private async preloadChordSheets(
    musician_id: string,
    items: Array<{
      title: string;
      artist: string;
      youtube_video_id: string;
      provider: "simpmusic" | "musify";
      music_library_id?: string;
      model_id?: string;
    }>,
  ) {
    const results: Array<{
      title: string;
      artist: string;
      youtube_video_id: string;
      music_library_id: string | null;
      reused_music_library: boolean;
      job: AiCifraAnalysisJobPresenter | null;
      error: string | null;
    }> = [];

    for (const item of items) {
      const title = String(item?.title ?? "").trim();
      const artist = String(item?.artist ?? "").trim();
      const youtubeVideoId = String(item?.youtube_video_id ?? "").trim();
      const provider = item?.provider;

      try {
        const normalizedProvidedMusicLibraryId =
          typeof item?.music_library_id === "string" &&
          item.music_library_id.trim().length > 0
            ? item.music_library_id.trim()
            : null;

        if (
          title.length === 0 ||
          artist.length === 0 ||
          youtubeVideoId.length === 0
        ) {
          throw new UnprocessableEntityException(
            "items[].title, items[].artist e items[].youtube_video_id são obrigatórios",
          );
        }

        if (provider !== "simpmusic" && provider !== "musify") {
          throw new UnprocessableEntityException("items[].provider inválido");
        }

        let musicLibraryId = normalizedProvidedMusicLibraryId;
        let reused = false;

        if (!musicLibraryId) {
          const result =
            await this.musicLibraryCatalogService.findOrCreateYoutube({
              musician_id,
              title,
              artist,
              youtube_video_id: youtubeVideoId,
            });
          musicLibraryId = result.item.id;
          reused = result.reused;
        }

        if (musicLibraryId) {
          await this.musicLibraryCatalogService.updateCatalogSource({
            id: musicLibraryId,
            musician_id,
            title,
            artist,
            source: "youtube",
            source_id: youtubeVideoId,
          });
        }

        const resolved = await this.resolveCandidatesUseCase.execute({
          youtube_video_id: youtubeVideoId,
        });

        const orderedCandidates =
          provider === "musify"
            ? this.prioritizeCandidates(resolved.candidates, "musify")
            : resolved.candidates;

        if (!orderedCandidates.length) {
          throw new UnprocessableEntityException("No candidates resolved");
        }

        const job = await this.requestAnalysisFromCandidates(musician_id, {
          music_library_id: musicLibraryId ?? undefined,
          model_id: item.model_id,
          candidates: orderedCandidates.map((c) => {
            return {
              audio_url: c.audio_url,
              content_type: c.content_type ?? undefined,
              original_filename: c.original_filename ?? undefined,
              source: c.source,
              source_id: c.source_id,
            };
          }),
        });

        results.push({
          title,
          artist,
          youtube_video_id: youtubeVideoId,
          music_library_id: musicLibraryId,
          reused_music_library: reused,
          job,
          error: null,
        });
      } catch (e: any) {
        results.push({
          title,
          artist,
          youtube_video_id: youtubeVideoId,
          music_library_id:
            typeof item?.music_library_id === "string"
              ? item.music_library_id
              : null,
          reused_music_library: false,
          job: null,
          error: this.formatError(e),
        });
      }
    }

    return results;
  }

  private async requestAnalysisFromCandidates(
    musician_id: string,
    dto: {
      music_library_id?: string;
      model_id?: string;
      candidates: Array<{
        audio_url: string;
        content_type?: string;
        original_filename?: string;
        source?: string;
        source_id?: string;
      }>;
    },
  ) {
    const normalizedMusicLibraryId =
      typeof dto.music_library_id === "string" && dto.music_library_id.trim()
        ? dto.music_library_id.trim()
        : undefined;

    if (normalizedMusicLibraryId && !isUUID(normalizedMusicLibraryId, "4")) {
      throw new UnprocessableEntityException("music_library_id must be a UUID");
    }

    if (!Array.isArray(dto.candidates) || dto.candidates.length === 0) {
      throw new UnprocessableEntityException("candidates is required");
    }

    let lastErrorMessage = "Falha ao obter áudio a partir das fontes";

    for (const candidate of dto.candidates ?? []) {
      const tmpPath = join(
        tmpdir(),
        `${Date.now()}-${randomUUID()}-source.audio`,
      );

      try {
        const downloaded = await this.downloadAudioToTempFile({
          url: candidate.audio_url,
          tmpPath,
          maxBytes: MAX_FILE_SIZE_BYTES,
        });

        const contentType =
          candidate.content_type ?? downloaded.content_type ?? "audio/mpeg";
        const originalFilename =
          candidate.original_filename ?? downloaded.original_filename;

        const upload = await this.createUploadUseCase.execute({
          musician_id,
          music_library_id: normalizedMusicLibraryId ?? null,
          original_filename: originalFilename,
          content_type: contentType,
          file_size: downloaded.file_size,
          data: createReadStream(tmpPath),
        });

        if (
          normalizedMusicLibraryId &&
          typeof candidate.source === "string" &&
          candidate.source.trim().length > 0
        ) {
          await this.musicLibraryCatalogService.updateCatalogSource({
            id: normalizedMusicLibraryId,
            musician_id,
            source: candidate.source.trim(),
            source_id:
              typeof candidate.source_id === "string" &&
              candidate.source_id.trim().length > 0
                ? candidate.source_id.trim()
                : null,
          });
        }

        const job = await this.requestAnalysisUseCase.execute({
          ai_cifra_upload_id: upload.id,
          model_id: dto.model_id,
        });

        return new AiCifraAnalysisJobPresenter(job);
      } catch (e: any) {
        lastErrorMessage = this.formatError(e);
      } finally {
        await fs.unlink(tmpPath).catch(() => undefined);
      }
    }

    throw new UnprocessableEntityException(lastErrorMessage);
  }

  private async downloadAudioToTempFile(input: {
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
}
