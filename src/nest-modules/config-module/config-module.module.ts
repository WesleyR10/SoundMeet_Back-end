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
};

export const CONFIG_DATABASE_CACHE_SCHEMA = {
  DATABASE_URL: Joi.string().required(),
  MONGODB_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
};

export const CONFIG_RABBITMQ_SCHEMA = {
  RABBITMQ_URL: Joi.string().required(),
  RABBITMQ_EXCHANGE: Joi.string().default("soundmeet.exchange"),
  RABBITMQ_QUEUE_REQUESTS: Joi.string().default("soundmeet.requests"),
  RABBITMQ_QUEUE_NOTIFICATIONS: Joi.string().default("soundmeet.notifications"),
  RABBITMQ_QUEUE_PAYMENTS: Joi.string().default("soundmeet.payments"),
  RABBITMQ_QUEUE_GAMIFICATION: Joi.string().default("soundmeet.gamification"),
};

export const CONFIG_AUTH_SCHEMA = {
  KEYCLOAK_URL: Joi.string().required(),
  KEYCLOAK_REALM: Joi.string().default("soundmeet"),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
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
};

export const CONFIG_PAYMENT_SCHEMA = {
  PIX_PROVIDER_URL: Joi.string().optional(),
  PIX_PROVIDER_TOKEN: Joi.string().optional(),
  PIX_WEBHOOK_SECRET: Joi.string().optional(),
};

export const CONFIG_NOTIFICATIONS_SCHEMA = {
  FIREBASE_PROJECT_ID: Joi.string().optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY: Joi.string().optional(),
};

export const CONFIG_LIMITS_SCHEMA = {
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),
  MAX_FILE_SIZE: Joi.number().default(10485760),
  ALLOWED_IMAGE_TYPES: Joi.string().default("image/jpeg,image/png,image/webp"),
  ALLOWED_VIDEO_TYPES: Joi.string().default("video/mp4,video/webm"),
  ALLOWED_AUDIO_TYPES: Joi.string().default("audio/mpeg,audio/wav,audio/ogg"),
  POINTS_SCAN_QR: Joi.number().default(10),
  POINTS_MUSIC_REQUEST: Joi.number().default(25),
  POINTS_REQUEST_ACCEPTED: Joi.number().default(50),
  POINTS_TIP_MULTIPLIER: Joi.number().default(1),
  POINTS_SOCIAL_SHARE: Joi.number().default(50),
  MAX_REQUESTS_PER_USER_PER_EVENT: Joi.number().default(5),
  REQUEST_COOLDOWN_MINUTES: Joi.number().default(2),
  VOTING_INTERVAL_MINUTES: Joi.number().default(3),
};

export const CONFIG_PRISMA_SCHEMA = {
  PRISMA_LOG_QUERIES: Joi.boolean().default(false),
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
      }),
      ...restOptions,
    });
  }
}
