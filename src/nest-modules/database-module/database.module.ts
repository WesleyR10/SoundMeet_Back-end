import { Global, Module } from "@nestjs/common";
import {
  MongooseModule,
  type MongooseModuleFactoryOptions,
} from "@nestjs/mongoose";
import { CacheModule } from "@nestjs/cache-manager";
import { redisStore } from "cache-manager-redis-store";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma/prisma.service";
import { ConfigSchemaType } from "../config-module/config.schema";

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
  const redisUrl = configService.get("REDIS_URL");
  const url = new URL(redisUrl);

  return {
    store: redisStore as any,
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
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
