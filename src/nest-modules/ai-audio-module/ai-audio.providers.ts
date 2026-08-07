import { S3Client } from "@aws-sdk/client-s3";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";

import { IAiAudioSeparationClient } from "../../core/ai-audio/application/ports/ai-audio-separation-client.interface";
import { IAiAudioSeparationDispatcher } from "../../core/ai-audio/application/ports/ai-audio-separation-dispatcher.interface";
import { IAiAudioStorage } from "../../core/ai-audio/application/ports/ai-audio-storage.interface";
import { CompleteAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/complete-ai-audio-separation-job/complete-ai-audio-separation-job.use-case";
import { CreateAiAudioUploadUseCase } from "../../core/ai-audio/application/use-cases/create-ai-audio-upload/create-ai-audio-upload.use-case";
import { FailAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/fail-ai-audio-separation-job/fail-ai-audio-separation-job.use-case";
import { GetAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/get-ai-audio-separation-job/get-ai-audio-separation-job.use-case";
import { ProcessAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/process-ai-audio-separation-job/process-ai-audio-separation-job.use-case";
import { RequestAiAudioSeparationUseCase } from "../../core/ai-audio/application/use-cases/request-ai-audio-separation/request-ai-audio-separation.use-case";
import { UpdateAiAudioSeparationJobProgressUseCase } from "../../core/ai-audio/application/use-cases/update-ai-audio-separation-job-progress/update-ai-audio-separation-job-progress.use-case";
import { IAiAudioSeparationJobRepository } from "../../core/ai-audio/domain/ai-audio-separation-job.repository";
import { IAiAudioUploadRepository } from "../../core/ai-audio/domain/ai-audio-upload.repository";
import { AiAudioSeparationJobPrismaRepository } from "../../core/ai-audio/infra/db/prisma/ai-audio-separation-job-prisma.repository";
import { AiAudioUploadPrismaRepository } from "../../core/ai-audio/infra/db/prisma/ai-audio-upload-prisma.repository";
import { AiAudioSeparationHttpClient } from "../../core/ai-audio/infra/http/ai-audio-separation-http.client";
import { S3AiAudioStorage } from "../../core/ai-audio/infra/storage/s3-ai-audio.storage";
import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";
import {
  AiAudioNoopDispatcher,
  AiAudioRabbitmqDispatcher,
  AiAudioSeparationDispatcher,
} from "./ai-audio.dispatcher";

const DEFAULT_ALLOWED_MODEL_IDS = [
  "htdemucs_4stems",
  "htdemucs_6stems",
  "mdx23c",
  "bs_roformer",
  "bs_roformer_4stems",
];

export const REPOSITORIES = {
  AI_AUDIO_UPLOAD_REPOSITORY: {
    provide: "AiAudioUploadRepository",
    useExisting: AiAudioUploadPrismaRepository,
  },
  AI_AUDIO_UPLOAD_PRISMA_REPOSITORY: {
    provide: AiAudioUploadPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new AiAudioUploadPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  AI_AUDIO_SEPARATION_JOB_REPOSITORY: {
    provide: "AiAudioSeparationJobRepository",
    useExisting: AiAudioSeparationJobPrismaRepository,
  },
  AI_AUDIO_SEPARATION_JOB_PRISMA_REPOSITORY: {
    provide: AiAudioSeparationJobPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new AiAudioSeparationJobPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const INFRA_PROVIDERS = {
  AI_AUDIO_STORAGE: {
    provide: "AiAudioStorage",
    useFactory: (configService: ConfigSchemaType) => {
      const provider = configService.get<
        "minio" | "aws_s3" | "cloudflare_r2" | undefined
      >("AI_AUDIO_STORAGE_PROVIDER");

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
        return new S3AiAudioStorage(s3, r2Bucket!, null);
      }

      if (provider === "minio") {
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
        return new S3AiAudioStorage(s3, minioBucket!, publicBaseUrl);
      }

      const s3 = new S3Client({ region });
      return new S3AiAudioStorage(s3, awsBucket!, cloudfrontUrl);
    },
    inject: [ConfigService],
  },
  AI_AUDIO_SEPARATION_CLIENT: {
    provide: "AiAudioSeparationClient",
    useFactory: (configService: ConfigSchemaType): IAiAudioSeparationClient => {
      const baseURL =
        configService.get<string>("AI_AUDIO_SEPARATION_HTTP_BASE_URL") ??
        "http://ai-audio-separation:8000";
      const path =
        configService.get<string>("AI_AUDIO_SEPARATION_HTTP_PATH") ??
        "/v1/separate";
      const timeoutMs =
        configService.get<number>("AI_AUDIO_SEPARATION_HTTP_TIMEOUT_MS") ??
        30 * 60 * 1000;
      return AiAudioSeparationHttpClient.create({
        baseURL,
        timeoutMs,
        path,
      });
    },
    inject: [ConfigService],
  },
  AI_AUDIO_SEPARATION_DISPATCHER: {
    provide: "AiAudioSeparationDispatcher",
    useFactory: (
      processUseCase: ProcessAiAudioSeparationJobUseCase,
      moduleRef: ModuleRef,
      configService: ConfigSchemaType,
    ): IAiAudioSeparationDispatcher => {
      const transport =
        configService.get<string>("AI_AUDIO_PROCESSING_TRANSPORT") ?? "http";
      if (transport === "rabbitmq") {
        const amqpConnection = moduleRef.get(AmqpConnection, { strict: false });
        if (!amqpConnection) {
          return new AiAudioNoopDispatcher();
        }
        const routingKey =
          configService.get<string>(
            "RABBITMQ_ROUTING_KEY_AI_AUDIO_UPLOAD_VALIDATED",
          ) ?? "ai-musician.audio-upload.validated";
        return new AiAudioRabbitmqDispatcher(amqpConnection, routingKey);
      }
      if (transport !== "http") {
        return new AiAudioNoopDispatcher();
      }
      const concurrency =
        configService.get<number>("AI_AUDIO_PROCESSING_CONCURRENCY") ?? 1;
      return new AiAudioSeparationDispatcher(processUseCase, concurrency, {
        maxQueueSize:
          configService.get<number>("AI_AUDIO_PROCESSING_MAX_QUEUE_SIZE") ??
          250,
        enqueueRetryDelayMs:
          configService.get<number>(
            "AI_AUDIO_PROCESSING_BACKPRESSURE_ENQUEUE_DELAY_MS",
          ) ?? 250,
        tickDelayMs:
          configService.get<number>(
            "AI_AUDIO_PROCESSING_BACKPRESSURE_TICK_MS",
          ) ?? 250,
        maxRssMb:
          configService.get<number>("AI_AUDIO_PROCESSING_MAX_RSS_MB") ?? null,
        maxLoadAvg1:
          configService.get<number>("AI_AUDIO_PROCESSING_MAX_LOADAVG_1") ??
          null,
        gpuMaxMemoryPercent:
          configService.get<number>(
            "AI_AUDIO_PROCESSING_GPU_MAX_MEMORY_PERCENT",
          ) ?? null,
        gpuCheckIntervalMs:
          configService.get<number>(
            "AI_AUDIO_PROCESSING_GPU_CHECK_INTERVAL_MS",
          ) ?? 2000,
      });
    },
    inject: [ProcessAiAudioSeparationJobUseCase, ModuleRef, ConfigService],
  },
};

export const USE_CASES = {
  CREATE_AI_AUDIO_UPLOAD_USE_CASE: {
    provide: CreateAiAudioUploadUseCase,
    useFactory: (
      uploadRepo: IAiAudioUploadRepository,
      storage: IAiAudioStorage,
      configService: ConfigSchemaType,
    ) => {
      const maxSize = configService.get<number>("AI_AUDIO_MAX_FILE_SIZE")!;
      const allowedMime = (
        configService.get<string>("AI_AUDIO_ALLOWED_MIME_TYPES") ?? ""
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return new CreateAiAudioUploadUseCase(
        uploadRepo,
        storage,
        maxSize,
        allowedMime,
      );
    },
    inject: [
      REPOSITORIES.AI_AUDIO_UPLOAD_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_AUDIO_STORAGE.provide,
      ConfigService,
    ],
  },
  REQUEST_AI_AUDIO_SEPARATION_USE_CASE: {
    provide: RequestAiAudioSeparationUseCase,
    useFactory: (
      uploadRepo: IAiAudioUploadRepository,
      jobRepo: IAiAudioSeparationJobRepository,
      dispatcher: IAiAudioSeparationDispatcher,
      storage: IAiAudioStorage,
      configService: ConfigSchemaType,
    ) => {
      const defaultModel =
        configService.get<string>("AI_AUDIO_DEFAULT_MODEL_ID") ??
        "htdemucs_4stems";
      const allowed = DEFAULT_ALLOWED_MODEL_IDS;
      return new RequestAiAudioSeparationUseCase(
        uploadRepo,
        jobRepo,
        dispatcher,
        storage,
        defaultModel,
        allowed,
      );
    },
    inject: [
      REPOSITORIES.AI_AUDIO_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_AUDIO_SEPARATION_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_AUDIO_SEPARATION_DISPATCHER.provide,
      INFRA_PROVIDERS.AI_AUDIO_STORAGE.provide,
      ConfigService,
    ],
  },
  PROCESS_AI_AUDIO_SEPARATION_JOB_USE_CASE: {
    provide: ProcessAiAudioSeparationJobUseCase,
    useFactory: (
      uploadRepo: IAiAudioUploadRepository,
      jobRepo: IAiAudioSeparationJobRepository,
      client: IAiAudioSeparationClient,
    ) => {
      return new ProcessAiAudioSeparationJobUseCase(
        uploadRepo,
        jobRepo,
        client,
      );
    },
    inject: [
      REPOSITORIES.AI_AUDIO_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_AUDIO_SEPARATION_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_AUDIO_SEPARATION_CLIENT.provide,
    ],
  },
  COMPLETE_AI_AUDIO_SEPARATION_JOB_USE_CASE: {
    provide: CompleteAiAudioSeparationJobUseCase,
    useFactory: (
      uploadRepo: IAiAudioUploadRepository,
      jobRepo: IAiAudioSeparationJobRepository,
    ) => {
      return new CompleteAiAudioSeparationJobUseCase(uploadRepo, jobRepo);
    },
    inject: [
      REPOSITORIES.AI_AUDIO_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_AUDIO_SEPARATION_JOB_REPOSITORY.provide,
    ],
  },
  FAIL_AI_AUDIO_SEPARATION_JOB_USE_CASE: {
    provide: FailAiAudioSeparationJobUseCase,
    useFactory: (
      uploadRepo: IAiAudioUploadRepository,
      jobRepo: IAiAudioSeparationJobRepository,
    ) => {
      return new FailAiAudioSeparationJobUseCase(uploadRepo, jobRepo);
    },
    inject: [
      REPOSITORIES.AI_AUDIO_UPLOAD_REPOSITORY.provide,
      REPOSITORIES.AI_AUDIO_SEPARATION_JOB_REPOSITORY.provide,
    ],
  },
  GET_AI_AUDIO_SEPARATION_JOB_USE_CASE: {
    provide: GetAiAudioSeparationJobUseCase,
    useFactory: (
      jobRepo: IAiAudioSeparationJobRepository,
      storage: IAiAudioStorage,
    ) => {
      return new GetAiAudioSeparationJobUseCase(jobRepo, storage);
    },
    inject: [
      REPOSITORIES.AI_AUDIO_SEPARATION_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.AI_AUDIO_STORAGE.provide,
    ],
  },
  UPDATE_AI_AUDIO_SEPARATION_JOB_PROGRESS_USE_CASE: {
    provide: UpdateAiAudioSeparationJobProgressUseCase,
    useFactory: (jobRepo: IAiAudioSeparationJobRepository) => {
      return new UpdateAiAudioSeparationJobProgressUseCase(jobRepo);
    },
    inject: [REPOSITORIES.AI_AUDIO_SEPARATION_JOB_REPOSITORY.provide],
  },
};

export const AI_AUDIO_PROVIDERS = {
  REPOSITORIES,
  INFRA_PROVIDERS,
  USE_CASES,
};
