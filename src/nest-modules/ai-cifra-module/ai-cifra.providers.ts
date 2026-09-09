import { S3Client } from "@aws-sdk/client-s3";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";

import { IAiCifraAnalysisClient } from "../../core/ai-cifra/application/ports/ai-cifra-analysis-client.interface";
import { IAiCifraAnalysisDispatcher } from "../../core/ai-cifra/application/ports/ai-cifra-analysis-dispatcher.interface";
import { IAiCifraAudioCandidatesResolver } from "../../core/ai-cifra/application/ports/ai-cifra-audio-candidates-resolver.interface";
import { IAiCifraStorage } from "../../core/ai-cifra/application/ports/ai-cifra-storage.interface";
import { CompleteAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/complete-ai-cifra-analysis-job/complete-ai-cifra-analysis-job.use-case";
import { CreateAiCifraUploadUseCase } from "../../core/ai-cifra/application/use-cases/create-ai-cifra-upload/create-ai-cifra-upload.use-case";
import { FailAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/fail-ai-cifra-analysis-job/fail-ai-cifra-analysis-job.use-case";
import { GetAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/get-ai-cifra-analysis-job/get-ai-cifra-analysis-job.use-case";
import { ProcessAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/process-ai-cifra-analysis-job/process-ai-cifra-analysis-job.use-case";
import { PurgeStaleAiCifraUploadsUseCase } from "../../core/ai-cifra/application/use-cases/purge-stale-ai-cifra-uploads/purge-stale-ai-cifra-uploads.use-case";
import { RequestAiCifraAnalysisUseCase } from "../../core/ai-cifra/application/use-cases/request-ai-cifra-analysis/request-ai-cifra-analysis.use-case";
import { ResolveAiCifraAudioCandidatesUseCase } from "../../core/ai-cifra/application/use-cases/resolve-ai-cifra-audio-candidates/resolve-ai-cifra-audio-candidates.use-case";
import { UpdateAiCifraAnalysisJobProgressUseCase } from "../../core/ai-cifra/application/use-cases/update-ai-cifra-analysis-job-progress/update-ai-cifra-analysis-job-progress.use-case";
import { IAiCifraAnalysisJobRepository } from "../../core/ai-cifra/domain/ai-cifra-analysis-job.repository";
import { IAiCifraUploadRepository } from "../../core/ai-cifra/domain/ai-cifra-upload.repository";
import { AiCifraAudioCandidatesResolver } from "../../core/ai-cifra/infra/audio-sources/ai-cifra-audio-candidates.resolver";
import { MusifyPipedAudioCandidatesResolver } from "../../core/ai-cifra/infra/audio-sources/musify-piped.audio-candidates-resolver";
import { SimpMusicYtDlpAudioCandidatesResolver } from "../../core/ai-cifra/infra/audio-sources/simpmusic-yt-dlp.audio-candidates-resolver";
import { AiCifraAnalysisJobPrismaRepository } from "../../core/ai-cifra/infra/db/prisma/ai-cifra-analysis-job-prisma.repository";
import { AiCifraUploadPrismaRepository } from "../../core/ai-cifra/infra/db/prisma/ai-cifra-upload-prisma.repository";
import { AiCifraAnalysisHttpClient } from "../../core/ai-cifra/infra/http/ai-cifra-analysis-http.client";
import { MusicLibraryOwnershipChecker } from "../../core/ai-cifra/infra/ownership/music-library-ownership.checker";
import { S3AiCifraStorage } from "../../core/ai-cifra/infra/storage/s3-ai-cifra.storage";
import { GetMusicLibraryUseCase } from "../../core/music-library/application/use-cases/get-music-library/get-music-library.use-case";
import { ResolveSpotifyTrackUseCase } from "../../core/music-library/application/use-cases/resolve-spotify-track/resolve-spotify-track.use-case";
import { UpdateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { AlignSyncedLyricsWordTimestampsUseCase } from "../../core/synced-lyrics/application/use-cases/align-synced-lyrics-word-timestamps/align-synced-lyrics-word-timestamps.use-case";
import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";
import {
  AiCifraAnalysisDispatcher,
  AiCifraNoopDispatcher,
  AiCifraRabbitmqDispatcher,
} from "./ai-cifra.dispatcher";
import { PurgeStaleAiCifraUploadsJob } from "./purge-stale-ai-cifra-uploads.job";

const DEFAULT_ALLOWED_MODEL_IDS = [
  "omar_rq_crnn_v1",
  "omar_rq_crnn_chords1217_8epochs",
  "chordformer_v12",
  "chordformer_v20_phase2b",
  "chordformer_v21_phase2",
  "chordformer_v21_phase2b",
  "chordformer_v22_phase2",
  "chordformer_v22_phase2b",
  "chordformer_v23_continuacao",
] as const;

export const REPOSITORIES = {
  AI_CIFRA_UPLOAD_REPOSITORY: {
    provide: "AiCifraUploadRepository",
    useExisting: AiCifraUploadPrismaRepository,
  },
  AI_CIFRA_UPLOAD_PRISMA_REPOSITORY: {
    provide: AiCifraUploadPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new AiCifraUploadPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  AI_CIFRA_ANALYSIS_JOB_REPOSITORY: {
    provide: "AiCifraAnalysisJobRepository",
    useExisting: AiCifraAnalysisJobPrismaRepository,
  },
  AI_CIFRA_ANALYSIS_JOB_PRISMA_REPOSITORY: {
    provide: AiCifraAnalysisJobPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new AiCifraAnalysisJobPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const INFRA_PROVIDERS = {
  AI_CIFRA_STORAGE: {
    provide: "AiCifraStorage",
    useFactory: (configService: ConfigSchemaType) => {
      const provider = configService.get<
        "minio" | "aws_s3" | "cloudflare_r2" | undefined
      >("AI_CIFRA_STORAGE_PROVIDER");

      const region = configService.get<string>("AWS_REGION") ?? "us-east-1";

      const awsBucket = configService.get<string>("AWS_S3_BUCKET");
      const cloudfrontUrl =
        configService.get<string>("AWS_CLOUDFRONT_URL") ?? null;

      const minioEndpoint = configService.get<string>("MINIO_ENDPOINT");
      const minioPort = configService.get<number>("MINIO_PORT");
      const minioAccessKey = configService.get<string>("MINIO_ACCESS_KEY");
      const minioSecretKey = configService.get<string>("MINIO_SECRET_KEY");
      const minioBucket = configService.get<string>("MINIO_BUCKET");
      const minioPublicEndpoint = configService.get<string>(
        "MINIO_PUBLIC_ENDPOINT",
      );
      const minioPublicPort = configService.get<number>("MINIO_PUBLIC_PORT");

      const r2Endpoint = configService.get<string>("CLOUDFLARE_R2_ENDPOINT");
      const r2AccessKey = configService.get<string>(
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
      );
      const r2SecretKey = configService.get<string>(
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      );
      const r2Bucket = configService.get<string>("CLOUDFLARE_R2_BUCKET");

      if (provider === "cloudflare_r2") {
        const s3 = new S3Client({
          region,
          endpoint: r2Endpoint,
          credentials: {
            accessKeyId: r2AccessKey!,
            secretAccessKey: r2SecretKey!,
          },
          forcePathStyle: true,
        });
        return new S3AiCifraStorage(s3, r2Bucket!, null);
      }

      if (provider === "minio" || !provider) {
        const endpoint = `http://${minioEndpoint}:${minioPort}`;
        const s3 = new S3Client({
          region,
          endpoint,
          credentials: {
            accessKeyId: minioAccessKey!,
            secretAccessKey: minioSecretKey!,
          },
          forcePathStyle: true,
        });
        const publicBaseUrl =
          minioPublicEndpoint && minioPublicPort && minioBucket
            ? `http://${minioPublicEndpoint}:${minioPublicPort}/${minioBucket}`
            : null;
        return new S3AiCifraStorage(s3, minioBucket!, publicBaseUrl);
      }

      const s3 = new S3Client({ region });
      return new S3AiCifraStorage(s3, awsBucket!, cloudfrontUrl);
    },
    inject: [ConfigService],
  },
  AI_CIFRA_ANALYSIS_CLIENT: {
    provide: "AiCifraAnalysisClient",
    useFactory: (configService: ConfigSchemaType): IAiCifraAnalysisClient => {
      const baseURL =
        configService.get<string>("AI_CIFRA_ANALYSIS_HTTP_BASE_URL") ??
        "http://ai-cifra-worker:8000";
      const path =
        configService.get<string>("AI_CIFRA_ANALYSIS_HTTP_PATH") ??
        "/v2/analyze";
      const timeoutMs =
        configService.get<number>("AI_CIFRA_ANALYSIS_HTTP_TIMEOUT_MS") ??
        30 * 60 * 1000;
      return AiCifraAnalysisHttpClient.create({
        baseURL,
        timeoutMs,
        path,
        workerToken: configService.get<string>("AI_WORKER_TOKEN"),
      });
    },
    inject: [ConfigService],
  },
  AI_CIFRA_ANALYSIS_DISPATCHER: {
    provide: "AiCifraAnalysisDispatcher",
    useFactory: (
      processUseCase: ProcessAiCifraAnalysisJobUseCase,
      failUseCase: FailAiCifraAnalysisJobUseCase,
      moduleRef: ModuleRef,
      configService: ConfigSchemaType,
    ): IAiCifraAnalysisDispatcher => {
      const transport =
        configService.get<string>("AI_CIFRA_PROCESSING_TRANSPORT") ?? "http";
      if (transport === "rabbitmq") {
        const amqpConnection = moduleRef.get(AmqpConnection, { strict: false });
        if (!amqpConnection) {
          return new AiCifraNoopDispatcher();
        }
        const routingKey =
          configService.get<string>(
            "RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_REQUESTED",
          ) ?? "ai-musician.cifra-analysis.requested";
        return new AiCifraRabbitmqDispatcher(amqpConnection, routingKey);
      }
      if (transport !== "http") {
        return new AiCifraNoopDispatcher();
      }
      const concurrency =
        configService.get<number>("AI_CIFRA_PROCESSING_CONCURRENCY") ?? 1;
      return new AiCifraAnalysisDispatcher(
        processUseCase,
        failUseCase,
        concurrency,
        {
          maxQueueSize:
            configService.get<number>("AI_CIFRA_PROCESSING_MAX_QUEUE_SIZE") ??
            250,
          enqueueRetryDelayMs:
            configService.get<number>(
              "AI_CIFRA_PROCESSING_BACKPRESSURE_ENQUEUE_DELAY_MS",
            ) ?? 250,
          tickDelayMs:
            configService.get<number>(
              "AI_CIFRA_PROCESSING_BACKPRESSURE_TICK_MS",
            ) ?? 250,
          maxRssMb:
            configService.get<number>("AI_CIFRA_PROCESSING_MAX_RSS_MB") ?? null,
          maxLoadAvg1:
            configService.get<number>("AI_CIFRA_PROCESSING_MAX_LOADAVG_1") ??
            null,
          gpuMaxMemoryPercent:
            configService.get<number>(
              "AI_CIFRA_PROCESSING_GPU_MAX_MEMORY_PERCENT",
            ) ?? null,
          gpuCheckIntervalMs:
            configService.get<number>(
              "AI_CIFRA_PROCESSING_GPU_CHECK_INTERVAL_MS",
            ) ?? 2000,
        },
      );
    },
    inject: [
      ProcessAiCifraAnalysisJobUseCase,
      FailAiCifraAnalysisJobUseCase,
      ModuleRef,
      ConfigService,
    ],
  },
  AI_CIFRA_AUDIO_CANDIDATES_RESOLVER: {
    provide: "AiCifraAudioCandidatesResolver",
    useFactory: (
      configService: ConfigSchemaType,
    ): IAiCifraAudioCandidatesResolver => {
      const ytDlpBin =
        configService.get<string>("AI_CIFRA_SIMPMUSIC_YTDLP_BIN") ?? "yt-dlp";
      const ytDlpTimeoutMs =
        configService.get<number>("AI_CIFRA_SIMPMUSIC_YTDLP_TIMEOUT_MS") ??
        30_000;
      const pipedBaseURL =
        configService.get<string>("AI_CIFRA_MUSIFY_PIPED_BASE_URL") ?? null;
      const pipedTimeoutMs =
        configService.get<number>("AI_CIFRA_MUSIFY_PIPED_TIMEOUT_MS") ?? 10_000;

      const simpmusic = new SimpMusicYtDlpAudioCandidatesResolver({
        ytDlpBin,
        timeoutMs: ytDlpTimeoutMs,
      });

      const musify = pipedBaseURL
        ? MusifyPipedAudioCandidatesResolver.create({
            baseURL: pipedBaseURL,
            timeoutMs: pipedTimeoutMs,
          })
        : null;

      return new AiCifraAudioCandidatesResolver(simpmusic, musify);
    },
    inject: [ConfigService],
  },
};

export const USE_CASES = {
  CREATE_AI_CIFRA_UPLOAD_USE_CASE: {
    provide: CreateAiCifraUploadUseCase,
    useFactory: (
      uploadRepo: IAiCifraUploadRepository,
      storage: IAiCifraStorage,
      configService: ConfigSchemaType,
      getMusicLibraryUseCase: GetMusicLibraryUseCase,
    ) => {
      const maxSize =
        configService.get<number>("AI_CIFRA_MAX_FILE_SIZE") ?? 70 * 1024 * 1024;
      const allowedMime = (
        configService.get<string>("AI_CIFRA_ALLOWED_MIME_TYPES") ??
        configService.get<string>("ALLOWED_AUDIO_TYPES") ??
        ""
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return new CreateAiCifraUploadUseCase(
        uploadRepo,
        storage,
        maxSize,
        allowedMime,
        new MusicLibraryOwnershipChecker(getMusicLibraryUseCase),
      );
    },
    inject: [
      REPOSITORIES.AI_CIFRA_UPLOAD_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_CIFRA_STORAGE.provide,
      ConfigService,
      GetMusicLibraryUseCase,
    ],
  },
  REQUEST_AI_CIFRA_ANALYSIS_USE_CASE: {
    provide: RequestAiCifraAnalysisUseCase,
    useFactory: (
      uploadRepo: IAiCifraUploadRepository,
      jobRepo: IAiCifraAnalysisJobRepository,
      dispatcher: IAiCifraAnalysisDispatcher,
      configService: ConfigSchemaType,
    ) => {
      const defaultModel =
        configService.get<string>("AI_CIFRA_DEFAULT_MODEL_ID") ??
        "omar_rq_crnn_chords1217_8epochs";
      const allowed = [...DEFAULT_ALLOWED_MODEL_IDS];
      return new RequestAiCifraAnalysisUseCase(
        uploadRepo,
        jobRepo,
        dispatcher,
        defaultModel,
        allowed,
      );
    },
    inject: [
      REPOSITORIES.AI_CIFRA_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_CIFRA_ANALYSIS_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_CIFRA_ANALYSIS_DISPATCHER.provide,
      ConfigService,
    ],
  },
  PROCESS_AI_CIFRA_ANALYSIS_JOB_USE_CASE: {
    provide: ProcessAiCifraAnalysisJobUseCase,
    useFactory: (
      uploadRepo: IAiCifraUploadRepository,
      jobRepo: IAiCifraAnalysisJobRepository,
      client: IAiCifraAnalysisClient,
      storage: IAiCifraStorage,
      getMusicLibraryUseCase: GetMusicLibraryUseCase,
      updateMusicLibraryUseCase: UpdateMusicLibraryUseCase,
      alignSyncedLyricsUseCase: AlignSyncedLyricsWordTimestampsUseCase,
    ) => {
      const musicLibraryLookup = {
        async findById(id: string) {
          try {
            const item = await getMusicLibraryUseCase.execute({ id });
            return {
              title: item.title,
              artist: item.artist,
            };
          } catch {
            return null;
          }
        },
      };
      return new ProcessAiCifraAnalysisJobUseCase(
        uploadRepo,
        jobRepo,
        client,
        storage,
        musicLibraryLookup,
        updateMusicLibraryUseCase,
        alignSyncedLyricsUseCase,
      );
    },
    inject: [
      REPOSITORIES.AI_CIFRA_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_CIFRA_ANALYSIS_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_CIFRA_ANALYSIS_CLIENT.provide,
      INFRA_PROVIDERS.AI_CIFRA_STORAGE.provide,
      GetMusicLibraryUseCase,
      UpdateMusicLibraryUseCase,
      AlignSyncedLyricsWordTimestampsUseCase,
    ],
  },
  COMPLETE_AI_CIFRA_ANALYSIS_JOB_USE_CASE: {
    provide: CompleteAiCifraAnalysisJobUseCase,
    useFactory: (
      uploadRepo: IAiCifraUploadRepository,
      jobRepo: IAiCifraAnalysisJobRepository,
      storage: IAiCifraStorage,
      updateMusicLibraryUseCase: UpdateMusicLibraryUseCase,
      alignSyncedLyricsUseCase: AlignSyncedLyricsWordTimestampsUseCase,
      resolveSpotifyTrackUseCase: ResolveSpotifyTrackUseCase,
    ) => {
      return new CompleteAiCifraAnalysisJobUseCase(
        uploadRepo,
        jobRepo,
        storage,
        updateMusicLibraryUseCase,
        alignSyncedLyricsUseCase,
        resolveSpotifyTrackUseCase,
      );
    },
    inject: [
      REPOSITORIES.AI_CIFRA_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_CIFRA_ANALYSIS_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_CIFRA_STORAGE.provide,
      UpdateMusicLibraryUseCase,
      AlignSyncedLyricsWordTimestampsUseCase,
      ResolveSpotifyTrackUseCase,
    ],
  },
  FAIL_AI_CIFRA_ANALYSIS_JOB_USE_CASE: {
    provide: FailAiCifraAnalysisJobUseCase,
    useFactory: (
      uploadRepo: IAiCifraUploadRepository,
      jobRepo: IAiCifraAnalysisJobRepository,
      storage: IAiCifraStorage,
    ) => {
      return new FailAiCifraAnalysisJobUseCase(uploadRepo, jobRepo, storage);
    },
    inject: [
      REPOSITORIES.AI_CIFRA_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_CIFRA_ANALYSIS_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_CIFRA_STORAGE.provide,
    ],
  },
  GET_AI_CIFRA_ANALYSIS_JOB_USE_CASE: {
    provide: GetAiCifraAnalysisJobUseCase,
    useFactory: (jobRepo: IAiCifraAnalysisJobRepository) => {
      return new GetAiCifraAnalysisJobUseCase(jobRepo);
    },
    inject: [REPOSITORIES.AI_CIFRA_ANALYSIS_JOB_REPOSITORY.provide],
  },
  UPDATE_AI_CIFRA_ANALYSIS_JOB_PROGRESS_USE_CASE: {
    provide: UpdateAiCifraAnalysisJobProgressUseCase,
    useFactory: (jobRepo: IAiCifraAnalysisJobRepository) => {
      return new UpdateAiCifraAnalysisJobProgressUseCase(jobRepo);
    },
    inject: [REPOSITORIES.AI_CIFRA_ANALYSIS_JOB_REPOSITORY.provide],
  },
  PURGE_STALE_AI_CIFRA_UPLOADS_USE_CASE: {
    provide: PurgeStaleAiCifraUploadsUseCase,
    useFactory: (
      uploadRepo: IAiCifraUploadRepository,
      storage: IAiCifraStorage,
      configService: ConfigSchemaType,
    ) => {
      const ttlMinutes =
        configService.get<number>("AI_CIFRA_AUDIO_TTL_MINUTES") ?? 60;
      return new PurgeStaleAiCifraUploadsUseCase(
        uploadRepo,
        storage,
        ttlMinutes,
      );
    },
    inject: [
      REPOSITORIES.AI_CIFRA_UPLOAD_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_CIFRA_STORAGE.provide,
      ConfigService,
    ],
  },
  RESOLVE_AI_CIFRA_AUDIO_CANDIDATES_USE_CASE: {
    provide: ResolveAiCifraAudioCandidatesUseCase,
    useFactory: (resolver: IAiCifraAudioCandidatesResolver) => {
      return new ResolveAiCifraAudioCandidatesUseCase(resolver);
    },
    inject: [INFRA_PROVIDERS.AI_CIFRA_AUDIO_CANDIDATES_RESOLVER.provide],
  },
};

export const JOBS = {
  PURGE_STALE_AI_CIFRA_UPLOADS_JOB: {
    provide: PurgeStaleAiCifraUploadsJob,
    useClass: PurgeStaleAiCifraUploadsJob,
  },
};

export const AI_CIFRA_PROVIDERS = {
  REPOSITORIES,
  INFRA_PROVIDERS,
  USE_CASES,
  JOBS,
};
