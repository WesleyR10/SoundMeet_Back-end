import { CacheModule } from "@nestjs/cache-manager";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  MongooseModule,
  type MongooseModuleFactoryOptions,
} from "@nestjs/mongoose";
import { redisStore } from "cache-manager-redis-store";

import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "./prisma/prisma.service";

export function createMongoConnectionOptions(
  configService: ConfigSchemaType,
): MongooseModuleFactoryOptions {
  const uri = configService.get<string>("MONGODB_URL");
  if (!uri?.trim()) {
    throw new Error("MONGODB_URL is not configured");
  }
  return {
    uri,
    retryWrites: true,
    w: "majority" as const,
  };
}

export async function createRedisCacheOptions(configService: ConfigSchemaType) {
  const redisUrl = configService.get<string>("REDIS_URL")!;
  const parsedUrl = new URL(redisUrl);
  const host = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 6379;
  const password = parsedUrl.password || undefined;
  return {
    store: redisStore as any,
    url: redisUrl,
    host,
    port,
    password,
    ttl: 300,
  };
}

const mongoModule =
  process.env.MONGODB_URL && process.env.MONGODB_URL.trim().length > 0
    ? [
        MongooseModule.forRootAsync({
          useFactory: createMongoConnectionOptions,
          inject: [ConfigService],
        }),
      ]
    : [];

@Global()
@Module({
  imports: [
    ...mongoModule,
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: createRedisCacheOptions,
      inject: [ConfigService],
    }),
  ],
  providers: [PrismaService],
  exports: [PrismaService, ...(mongoModule.length ? [MongooseModule] : [])],
})
export class DatabaseModule {}
