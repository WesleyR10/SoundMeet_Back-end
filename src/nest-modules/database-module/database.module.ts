import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CacheModule } from "@nestjs/cache-manager";
import { redisStore } from "cache-manager-redis-store";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "./prisma/prisma.service";
import { ConfigSchemaType } from "../config-module/config.schema";

@Global()
@Module({
  imports: [
    // MongoDB Connection
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigSchemaType) => ({
        uri: configService.get("MONGODB_URL"),
        retryWrites: true,
        w: "majority",
      }),
      inject: [ConfigService],
    }),

    // Redis Cache
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigSchemaType) => {
        const redisUrl = configService.get("REDIS_URL");
        const url = new URL(redisUrl);

        return {
          store: redisStore as any,
          host: url.hostname,
          port: parseInt(url.port) || 6379,
          password: url.password || undefined,
          ttl: 300, // 5 minutes default TTL
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [PrismaService],
  exports: [PrismaService, MongooseModule],
})
export class DatabaseModule {}
