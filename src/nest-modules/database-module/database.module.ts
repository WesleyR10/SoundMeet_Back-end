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
  return {
    uri: configService.get<string>("MONGODB_URL")!,
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

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: createMongoConnectionOptions,
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: createRedisCacheOptions,
      inject: [ConfigService],
    }),
  ],
  providers: [PrismaService],
  exports: [PrismaService, MongooseModule],
})
export class DatabaseModule {}
