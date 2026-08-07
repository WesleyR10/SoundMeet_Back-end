import KeyvRedis from "@keyv/redis";
import { CacheModule } from "@nestjs/cache-manager";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Keyv } from "keyv";

import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "./prisma/prisma.service";

// TTL padrão do cache global. A partir do cache-manager v6 (Keyv) todo TTL é
// em MILISSEGUNDOS — na v5 era em segundos. Ver DEFAULT_CACHE_TTL_MS e os
// call sites de `cache.set(...)`, que também passaram a multiplicar por 1000.
export const DEFAULT_CACHE_TTL_MS = 300 * 1000;

export async function createRedisCacheOptions(configService: ConfigSchemaType) {
  const redisUrl = configService.get<string>("REDIS_URL")!;
  const parsedUrl = new URL(redisUrl);
  const host = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 6379;
  const password = parsedUrl.password || undefined;
  return {
    stores: [new Keyv({ store: new KeyvRedis(redisUrl) })],
    url: redisUrl,
    host,
    port,
    password,
    ttl: DEFAULT_CACHE_TTL_MS,
  };
}

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: createRedisCacheOptions,
      inject: [ConfigService],
    }),
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
