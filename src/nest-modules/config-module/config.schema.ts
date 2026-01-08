import { ConfigService } from "@nestjs/config";

export const CONFIG_SCHEMA_TYPE = Symbol("CONFIG_SCHEMA_TYPE");

export type EnvConfig = {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  APP_URL: string;

  // Database URLs
  DATABASE_URL: string;
  MONGODB_URL: string;
  REDIS_URL: string;

  // RabbitMQ
  RABBITMQ_URL: string;
  RABBITMQ_EXCHANGE: string;
  RABBITMQ_QUEUE_REQUESTS: string;
  RABBITMQ_QUEUE_NOTIFICATIONS: string;
  RABBITMQ_QUEUE_PAYMENTS: string;
  RABBITMQ_QUEUE_GAMIFICATION: string;

  // Keycloak
  KEYCLOAK_URL: string;
  KEYCLOAK_REALM: string;
  KEYCLOAK_CLIENT_ID: string;
  KEYCLOAK_CLIENT_SECRET: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // AWS S3
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_S3_BUCKET: string;
  AWS_CLOUDFRONT_URL?: string;

  // MinIO (Development)
  MINIO_ENDPOINT: string;
  MINIO_PORT: number;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;

  // External APIs
  CIFRA_CLUB_API_KEY?: string;
  ULTIMATE_GUITAR_API_KEY?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;

  // PIX Payment
  PIX_PROVIDER_URL?: string;
  PIX_PROVIDER_TOKEN?: string;
  PIX_WEBHOOK_SECRET?: string;

  // Push Notifications
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_SERVICE_ACCOUNT_KEY?: string;

  // Rate Limiting
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;

  // File Upload
  MAX_FILE_SIZE: number;
  ALLOWED_IMAGE_TYPES: string;
  ALLOWED_VIDEO_TYPES: string;
  ALLOWED_AUDIO_TYPES: string;

  // Gamification
  POINTS_SCAN_QR: number;
  POINTS_MUSIC_REQUEST: number;
  POINTS_REQUEST_ACCEPTED: number;
  POINTS_TIP_MULTIPLIER: number;
  POINTS_SOCIAL_SHARE: number;

  // Anti-Spam
  MAX_REQUESTS_PER_USER_PER_EVENT: number;
  REQUEST_COOLDOWN_MINUTES: number;
  VOTING_INTERVAL_MINUTES: number;

  // Scheduling
  BOOKING_DEFAULT_FREE_CANCELLATION_HOURS: number;

  // Prisma
  PRISMA_LOG_QUERIES: boolean;
};

export type ConfigSchemaType = ConfigService<EnvConfig>;
