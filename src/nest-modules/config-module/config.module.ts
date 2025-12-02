import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Joi from "joi";

import { CONFIG_SCHEMA_TYPE } from "./config.schema";

export type ConfigSchemaType = typeof CONFIG_SCHEMA_TYPE;

@Global()
@Module({})
export class ConfigModuleRoot {
  static forRoot() {
    return {
      module: ConfigModuleRoot,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath:
            process.env.NODE_ENV === "test"
              ? [".env.e2e", ".env.local", ".env"]
              : [".env.local", ".env"],
          validationSchema: Joi.object({
            // Environment
            NODE_ENV: Joi.string()
              .valid("development", "production", "test")
              .default("development"),
            PORT: Joi.number().default(3000),
            APP_URL: Joi.string().default("https://soundmeet.app"),

            // Database URLs
            DATABASE_URL: Joi.string().required(),
            MONGODB_URL: Joi.string().required(),
            REDIS_URL: Joi.string().required(),

            // RabbitMQ
            RABBITMQ_URL: Joi.string().required(),
            RABBITMQ_EXCHANGE: Joi.string().default("soundmeet.exchange"),
            RABBITMQ_QUEUE_REQUESTS: Joi.string().default("soundmeet.requests"),
            RABBITMQ_QUEUE_NOTIFICATIONS: Joi.string().default(
              "soundmeet.notifications",
            ),
            RABBITMQ_QUEUE_PAYMENTS: Joi.string().default("soundmeet.payments"),
            RABBITMQ_QUEUE_GAMIFICATION: Joi.string().default(
              "soundmeet.gamification",
            ),

            // Keycloak
            KEYCLOAK_URL: Joi.string().required(),
            KEYCLOAK_REALM: Joi.string().default("soundmeet"),
            KEYCLOAK_CLIENT_ID: Joi.string().required(),
            KEYCLOAK_CLIENT_SECRET: Joi.string().required(),

            // JWT
            JWT_SECRET: Joi.string().required(),
            JWT_EXPIRES_IN: Joi.string().default("24h"),
            JWT_REFRESH_SECRET: Joi.string().required(),
            JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),

            // AWS S3
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

            // MinIO (Development)
            MINIO_ENDPOINT: Joi.string().default("localhost"),
            MINIO_PORT: Joi.number().default(9000),
            MINIO_ACCESS_KEY: Joi.string().default("soundmeet"),
            MINIO_SECRET_KEY: Joi.string().default("soundmeet123"),
            MINIO_BUCKET: Joi.string().default("soundmeet-media"),

            // External APIs
            CIFRA_CLUB_API_KEY: Joi.string().optional(),
            ULTIMATE_GUITAR_API_KEY: Joi.string().optional(),
            SPOTIFY_CLIENT_ID: Joi.string().optional(),
            SPOTIFY_CLIENT_SECRET: Joi.string().optional(),

            // PIX Payment
            PIX_PROVIDER_URL: Joi.string().optional(),
            PIX_PROVIDER_TOKEN: Joi.string().optional(),
            PIX_WEBHOOK_SECRET: Joi.string().optional(),

            // Push Notifications
            FIREBASE_PROJECT_ID: Joi.string().optional(),
            FIREBASE_PRIVATE_KEY: Joi.string().optional(),
            FIREBASE_CLIENT_EMAIL: Joi.string().optional(),
            FIREBASE_SERVICE_ACCOUNT_KEY: Joi.string().optional(),

            // Rate Limiting
            RATE_LIMIT_TTL: Joi.number().default(60),
            RATE_LIMIT_MAX: Joi.number().default(100),

            // File Upload
            MAX_FILE_SIZE: Joi.number().default(10485760), // 10MB
            ALLOWED_IMAGE_TYPES: Joi.string().default(
              "image/jpeg,image/png,image/webp",
            ),
            ALLOWED_VIDEO_TYPES: Joi.string().default("video/mp4,video/webm"),
            ALLOWED_AUDIO_TYPES: Joi.string().default(
              "audio/mpeg,audio/wav,audio/ogg",
            ),

            // Gamification
            POINTS_SCAN_QR: Joi.number().default(10),
            POINTS_MUSIC_REQUEST: Joi.number().default(25),
            POINTS_REQUEST_ACCEPTED: Joi.number().default(50),
            POINTS_TIP_MULTIPLIER: Joi.number().default(1),
            POINTS_SOCIAL_SHARE: Joi.number().default(50),

            // Anti-Spam
            MAX_REQUESTS_PER_USER_PER_EVENT: Joi.number().default(5),
            REQUEST_COOLDOWN_MINUTES: Joi.number().default(2),
            VOTING_INTERVAL_MINUTES: Joi.number().default(3),
          }),
          validationOptions: {
            abortEarly: false,
          },
        }),
      ],
      providers: [
        {
          provide: CONFIG_SCHEMA_TYPE,
          useFactory: (configService: ConfigService) => configService,
          inject: [ConfigService],
        },
      ],
      exports: [CONFIG_SCHEMA_TYPE],
    };
  }
}
