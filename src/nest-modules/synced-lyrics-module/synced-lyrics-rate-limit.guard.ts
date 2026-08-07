import { CACHE_MANAGER } from "@nestjs/cache-manager";
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";

import { ConfigSchemaType } from "../config-module/config.schema";

@Injectable()
export class SyncedLyricsRateLimitGuard implements CanActivate {
  @Inject(CACHE_MANAGER)
  private cache: Cache;

  @Inject(ConfigService)
  private configService: ConfigSchemaType;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request) {
      return true;
    }

    const ttlSeconds = this.configService.get<number>("RATE_LIMIT_TTL") ?? 60;
    const max = this.configService.get<number>("RATE_LIMIT_MAX") ?? 100;

    const ip =
      String(
        request.headers?.["x-forwarded-for"] ??
          request.ip ??
          request.connection?.remoteAddress ??
          "unknown",
      )
        .split(",")[0]
        ?.trim() ?? "unknown";

    const method = String(request.method ?? "").toUpperCase();
    const routePath =
      request.route?.path ?? request.path ?? request.originalUrl ?? "unknown";

    const key = `rate_limit:synced_lyrics:${method}:${routePath}:${ip}`;

    try {
      const current = (await this.cache.get<number>(key)) ?? 0;
      if (current >= max) {
        throw new HttpException(
          "Too Many Requests",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      // TTL em MILISSEGUNDOS (cache-manager v6+ / Keyv); RATE_LIMIT_TTL
      // continua expresso em segundos na config.
      await this.cache.set(key, current + 1, ttlSeconds * 1000);
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error;
      }
      if (method !== "GET") {
        throw new HttpException(
          "Rate limit unavailable",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return true;
    }

    return true;
  }
}
