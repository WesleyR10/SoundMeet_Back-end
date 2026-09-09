import { CACHE_MANAGER } from "@nestjs/cache-manager";
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";

import { AuthJwtVerifier } from "../auth-module/auth-jwt.verifier";
import { ConfigSchemaType } from "../config-module/config.schema";

/**
 * Rate limit dedicado do subsistema de letras — o que protege o egress para a
 * LRCLIB, que é uma API pública gratuita de terceiro.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SM-027 — `X-Forwarded-For` NUNCA entra na chave
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A versão anterior fazia `request.headers["x-forwarded-for"] ?? request.ip`,
 * nessa ordem e sem nenhuma noção de proxy confiável. Como o header é escrito
 * pelo cliente, bastava mandar um valor diferente a cada requisição para ganhar
 * um balde novo toda vez: o limite não limitava nada. E era o único controle
 * entre a internet anônima e a cota da LRCLIB.
 *
 * A correção NÃO é `app.set("trust proxy", <n>)`. Esse número muda entre
 * docker-compose, load balancer e CDN, e errar para mais é exatamente como se
 * falsifica origem — o raciocínio completo está em
 * `shared-module/guards/user-throttler.guard.ts`, e este guard segue a mesma
 * decisão para não haver duas respostas diferentes para a mesma pergunta.
 *
 * A chave passa a ser, nesta ordem:
 *
 * 1. `user:<sub>` de um JWT **verificado** — imune a topologia de proxy, e
 *    conseguir um balde novo exige uma conta de verdade no provedor de
 *    identidade;
 * 2. `ip:<request.ip>` — o endereço do socket, que atrás de proxy é o do
 *    proxy. Atribui de menos (usuários anônimos somam num balde só), nunca de
 *    mais: é a direção segura para errar.
 *
 * ⚠️ **Nunca lançar por causa do token**, pelo mesmo motivo do
 * `UserThrottlerGuard`: quem decide se a requisição está autenticada é o
 * `AuthGuard`. Token ausente, expirado ou de outro emissor degrada para IP em
 * silêncio.
 *
 * O verificador é `@Optional()` porque o `AuthModule` é `@Global()` mas os
 * testes unitários constroem o guard com `new` — sem o decorador, um contexto
 * de teste sem o provider quebraria a instanciação em vez de degradar.
 */
@Injectable()
export class SyncedLyricsRateLimitGuard implements CanActivate {
  @Inject(CACHE_MANAGER)
  private cache: Cache;

  @Inject(ConfigService)
  private configService: ConfigSchemaType;

  @Optional()
  @Inject(AuthJwtVerifier)
  private jwtVerifier?: AuthJwtVerifier;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request) {
      return true;
    }

    const ttlSeconds = this.configService.get<number>("RATE_LIMIT_TTL") ?? 60;
    const max = this.configService.get<number>("RATE_LIMIT_MAX") ?? 100;

    const tracker = await this.resolveTracker(request);

    const method = String(request.method ?? "").toUpperCase();
    const routePath =
      request.route?.path ?? request.path ?? request.originalUrl ?? "unknown";

    const key = `rate_limit:synced_lyrics:${method}:${routePath}:${tracker}`;

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

  /**
   * Prefixos `user:` / `ip:` para que um `sub` que por acaso fosse igual a um
   * endereço não somasse as duas contagens — mesma razão do `UserThrottlerGuard`.
   */
  private async resolveTracker(request: Record<string, any>): Promise<string> {
    const token = this.extractBearerToken(request);

    if (token && this.jwtVerifier) {
      try {
        const payload = await this.jwtVerifier.verify(token);
        const sub = payload?.sub;
        if (typeof sub === "string" && sub.length > 0) {
          return `user:${sub}`;
        }
      } catch {
        // Degrada para IP — ver a nota sobre nunca lançar daqui.
      }
    }

    const ip = request.ip ?? request.socket?.remoteAddress ?? "unknown";
    return `ip:${String(ip)}`;
  }

  private extractBearerToken(request: Record<string, any>): string | undefined {
    const authorization = request?.headers?.authorization;
    if (typeof authorization !== "string") {
      return undefined;
    }

    const [type, token] = authorization.split(" ");
    return type === "Bearer" && token ? token : undefined;
  }
}
