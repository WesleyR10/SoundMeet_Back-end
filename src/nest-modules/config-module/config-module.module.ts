import { Global, Module } from "@nestjs/common";
import {
  ConfigModule as NestConfigModule,
  ConfigModuleOptions,
} from "@nestjs/config";
import Joi from "joi";
import { join } from "path";

import { CONFIG_SCHEMA_TYPE } from "./config.schema";

export type ConfigSchemaType = typeof CONFIG_SCHEMA_TYPE;

export const CONFIG_ENV_SCHEMA = {
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().default("https://soundmeet.app"),
  SWAGGER_EXAMPLES_ENABLED: Joi.boolean().default(true),
  SWAGGER_EXAMPLES_REQUIRED_ONLY: Joi.boolean().default(false),
};

export const CONFIG_DATABASE_CACHE_SCHEMA = {
  DATABASE_URL: Joi.string().required(),
  MONGODB_URL: Joi.string().allow("").optional(),
  REDIS_URL: Joi.string().required(),
};

export const CONFIG_RABBITMQ_SCHEMA = {
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ["amqp", "amqps"] })
    .required(),
  RABBITMQ_EXCHANGE: Joi.string().default("soundmeet.exchange"),
  RABBITMQ_QUEUE_REQUESTS: Joi.string().default("soundmeet.requests"),
  RABBITMQ_QUEUE_NOTIFICATIONS: Joi.string().default("soundmeet.notifications"),
  RABBITMQ_QUEUE_PAYMENTS: Joi.string().default("soundmeet.payments"),
  RABBITMQ_QUEUE_GAMIFICATION: Joi.string().default("soundmeet.gamification"),
  RABBITMQ_REGISTER_HANDLERS: Joi.boolean().default(false),

  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_REQUESTED: Joi.string().optional(),
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_COMPLETED: Joi.string().optional(),
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_FAILED: Joi.string().optional(),
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_PROGRESS: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_COMPLETED: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_FAILED: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_PROGRESS: Joi.string().optional(),

  RABBITMQ_ROUTING_KEY_SYNCED_LYRICS_BULK_REQUESTED: Joi.string().optional(),
  RABBITMQ_QUEUE_SYNCED_LYRICS_BULK: Joi.string().optional(),
};

export const CONFIG_AUTH_SCHEMA = {
  AUTH_JWT_VALIDATION_MODE: Joi.string()
    .valid("local", "keycloak")
    .when("NODE_ENV", {
      is: "production",
      then: Joi.string().valid("keycloak").default("keycloak"),
      otherwise: Joi.string().valid("local", "keycloak").default("local"),
    }),
  KEYCLOAK_URL: Joi.string().required(),
  KEYCLOAK_REALM: Joi.string().default("soundmeet"),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
  KEYCLOAK_MOBILE_CLIENT_ID: Joi.string().default("soundmeet-mobile"),
  KEYCLOAK_INTERNAL_URL: Joi.string().uri().optional(),
  KEYCLOAK_JWKS_URI: Joi.string().uri().optional(),
  KEYCLOAK_JWKS_CACHE_TTL_SECONDS: Joi.number().min(1).default(300),
  KEYCLOAK_VERIFY_AUDIENCE: Joi.boolean().default(false),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default("24h"),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
};

export const CONFIG_STORAGE_SCHEMA = {
  AWS_REGION: Joi.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AWS_SECRET_ACCESS_KEY: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AWS_S3_BUCKET: Joi.string().default("soundmeet-media"),
  AWS_CLOUDFRONT_URL: Joi.string().optional(),
  MINIO_ENDPOINT: Joi.string().default("localhost"),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().default("soundmeet"),
  MINIO_SECRET_KEY: Joi.string().default("soundmeet123"),
  MINIO_BUCKET: Joi.string().default("soundmeet-media"),
};

export const CONFIG_EXTERNAL_APIS_SCHEMA = {
  CIFRA_CLUB_API_KEY: Joi.string().optional(),
  ULTIMATE_GUITAR_API_KEY: Joi.string().optional(),
  SPOTIFY_CLIENT_ID: Joi.string().optional(),
  SPOTIFY_CLIENT_SECRET: Joi.string().optional(),
  GENIUS_CLIENT_ID: Joi.string().optional(),
  GENIUS_CLIENT_SECRET: Joi.string().optional(),
  GENIUS_ACCESS_TOKEN: Joi.string().optional(),
};

export const CONFIG_PAYMENT_SCHEMA = {
  // Asaas — cachê de show, escrow, assinaturas, saque PIX
  ASAAS_API_URL: Joi.string().uri().default("https://sandbox.asaas.com/api/v3"),
  ASAAS_API_KEY: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ASAAS_WALLET_ID: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().uuid().required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ASAAS_WEBHOOK_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),

  // Iugu — gorjetas PIX (0,99%, sem mínimo fixo)
  IUGU_API_URL: Joi.string().uri().default("https://api.iugu.com/v1"),
  IUGU_API_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  IUGU_ACCOUNT_ID: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  IUGU_WEBHOOK_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
};

export const CONFIG_NOTIFICATIONS_SCHEMA = {
  FIREBASE_PROJECT_ID: Joi.string().optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY: Joi.string().optional(),
};

export const CONFIG_LIMITS_SCHEMA = {
  RATE_LIMIT_TTL: Joi.number().default(60), // Tempo de expiração do limite de taxa em segundos
  RATE_LIMIT_MAX: Joi.number().default(100), // Máximo de requisições permitidas por RATE_LIMIT_TTL
  MAX_FILE_SIZE: Joi.number().default(10485760), // Tamanho máximo de arquivo em bytes
  ALLOWED_IMAGE_TYPES: Joi.string().default("image/jpeg,image/png,image/webp"), // Tipos de arquivos de imagem permitidos
  ALLOWED_VIDEO_TYPES: Joi.string().default("video/mp4,video/webm"), // Tipos de arquivos de vídeo permitidos
  ALLOWED_AUDIO_TYPES: Joi.string().default("audio/mpeg,audio/wav,audio/ogg"), // Tipos de arquivos de áudio permitidos
  POINTS_SCAN_QR: Joi.number().default(10), // Pontos ganhos ao escanear um QR code
  POINTS_MUSIC_REQUEST: Joi.number().default(25), // Pontos ganhos ao fazer uma solicitação de música
  POINTS_REQUEST_ACCEPTED: Joi.number().default(50), // Pontos ganhos ao aceitar uma solicitação
  POINTS_TIP_MULTIPLIER: Joi.number().default(1), // Multiplicador de pontos ao dar um "tip"
  POINTS_SOCIAL_SHARE: Joi.number().default(50), // Pontos ganhos ao compartilhar uma solicitação socialmente
  MAX_REQUESTS_PER_USER_PER_EVENT: Joi.number().default(10), // Máximo de solicitações por usuário por evento
  REQUEST_COOLDOWN_MINUTES: Joi.number().default(120), // Cooldown ( Tempo mínimo entre solicitações) entre solicitações em minutos
  REQUEST_RESPONSE_TIME_MINUTES: Joi.number().default(60), // Tempo máximo para resposta de uma solicitação em minutos
  VOTING_INTERVAL_MINUTES: Joi.number().default(3), // Intervalo de votação em minutos

  BOOKING_DEFAULT_FREE_CANCELLATION_HOURS: Joi.number().min(0).default(72),
};

export const CONFIG_PRISMA_SCHEMA = {
  PRISMA_LOG_QUERIES: Joi.boolean().default(false),
};

export const CONFIG_AI_AUDIO_SCHEMA = {
  AI_AUDIO_PROCESSING_TRANSPORT: Joi.string()
    .valid("http", "rabbitmq")
    .default("http"),
  AI_AUDIO_PROGRESS_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
};

export const CONFIG_AI_CIFRA_SCHEMA = {
  AI_CIFRA_STORAGE_PROVIDER: Joi.string()
    .valid("minio", "aws_s3", "cloudflare_r2")
    .optional(),
  AI_CIFRA_MAX_FILE_SIZE: Joi.number().optional(),
  AI_CIFRA_ALLOWED_MIME_TYPES: Joi.string().optional(),
  AI_CIFRA_DEFAULT_MODEL_ID: Joi.string().optional(),
  AI_CIFRA_ANALYSIS_HTTP_BASE_URL: Joi.string().optional(),
  AI_CIFRA_ANALYSIS_HTTP_PATH: Joi.string().optional(),
  AI_CIFRA_ANALYSIS_HTTP_TIMEOUT_MS: Joi.number().optional(),
  AI_CIFRA_PROCESSING_TRANSPORT: Joi.string()
    .valid("http", "rabbitmq")
    .optional(),
  AI_CIFRA_PROCESSING_CONCURRENCY: Joi.number().min(1).optional(),
  AI_CIFRA_PROCESSING_MAX_QUEUE_SIZE: Joi.number().min(1).optional(),
  AI_CIFRA_PROCESSING_BACKPRESSURE_ENQUEUE_DELAY_MS: Joi.number()
    .min(0)
    .optional(),
  AI_CIFRA_PROCESSING_BACKPRESSURE_TICK_MS: Joi.number().min(0).optional(),
  AI_CIFRA_PROCESSING_MAX_RSS_MB: Joi.number().min(1).allow(null).optional(),
  AI_CIFRA_PROCESSING_MAX_LOADAVG_1: Joi.number().min(0).allow(null).optional(),
  AI_CIFRA_PROCESSING_GPU_MAX_MEMORY_PERCENT: Joi.number()
    .min(0)
    .max(100)
    .allow(null)
    .optional(),
  AI_CIFRA_PROCESSING_GPU_CHECK_INTERVAL_MS: Joi.number().min(0).optional(),
  AI_CIFRA_PROGRESS_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  AI_CIFRA_AUDIO_TTL_MINUTES: Joi.number().min(1).default(60),
  AI_CIFRA_SIMPMUSIC_YTDLP_BIN: Joi.string().default("yt-dlp"),
  AI_CIFRA_SIMPMUSIC_YTDLP_TIMEOUT_MS: Joi.number().min(1).default(30_000),
  AI_CIFRA_MUSIFY_PIPED_BASE_URL: Joi.string().uri().optional(),
  AI_CIFRA_MUSIFY_PIPED_TIMEOUT_MS: Joi.number().min(1).default(10_000),
};

export const CONFIG_SYNCED_LYRICS_SCHEMA = {
  SYNCED_LYRICS_BULK_TRANSPORT: Joi.string()
    .valid("inline", "rabbitmq")
    .default("inline"),
  SYNCED_LYRICS_BULK_CONCURRENCY: Joi.number().min(1).default(4),
  SYNCED_LYRICS_BULK_MAX_QUEUE_SIZE: Joi.number().min(1).default(500),
  SYNCED_LYRICS_BULK_BACKPRESSURE_ENQUEUE_DELAY_MS: Joi.number()
    .min(0)
    .default(250),
  SYNCED_LYRICS_BULK_BACKPRESSURE_TICK_MS: Joi.number().min(0).default(250),
  SYNCED_LYRICS_BULK_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
};

@Global()
@Module({})
export class ConfigModuleRoot extends NestConfigModule {
  static forRoot(options: ConfigModuleOptions = {}) {
    const { envFilePath, ...restOptions } = options;

    const defaultEnvFiles =
      process.env.NODE_ENV === "test"
        ? [".env.e2e", ".env.local", ".env"]
        : [".env.local", ".env"];

    const providedEnvFiles = envFilePath
      ? Array.isArray(envFilePath)
        ? envFilePath
        : [envFilePath]
      : [];

    const envsFolderFiles = [
      ...(process.env.NODE_ENV === "test"
        ? [join(process.cwd(), "envs", ".env.e2e")]
        : []),
      join(
        process.cwd(),
        "envs",
        `.env.${process.env.NODE_ENV || "development"}`,
      ),
      join(process.cwd(), "envs", `.env`),
    ];

    return super.forRoot({
      isGlobal: true,
      envFilePath: [
        ...providedEnvFiles,
        ...defaultEnvFiles,
        ...envsFolderFiles,
      ],
      validationSchema: Joi.object({
        ...CONFIG_ENV_SCHEMA,
        ...CONFIG_DATABASE_CACHE_SCHEMA,
        ...CONFIG_RABBITMQ_SCHEMA,
        ...CONFIG_AUTH_SCHEMA,
        ...CONFIG_STORAGE_SCHEMA,
        ...CONFIG_EXTERNAL_APIS_SCHEMA,
        ...CONFIG_PAYMENT_SCHEMA,
        ...CONFIG_NOTIFICATIONS_SCHEMA,
        ...CONFIG_LIMITS_SCHEMA,
        ...CONFIG_PRISMA_SCHEMA,
        ...CONFIG_AI_AUDIO_SCHEMA,
        ...CONFIG_AI_CIFRA_SCHEMA,
        ...CONFIG_SYNCED_LYRICS_SCHEMA,
      }),
      ...restOptions,
    });
  }
}
