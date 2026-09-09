import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "crypto";
import { Request } from "express";

import { EnvConfig } from "../config-module/config.schema";
import {
  INTERNAL_TOKEN_KEY,
  InternalTokenMetadata,
} from "./internal-token.decorator";

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService<EnvConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }

    const metadata = this.reflector.getAllAndOverride<InternalTokenMetadata>(
      INTERNAL_TOKEN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) {
      return true;
    }

    const expected = this.configService.get<string>(
      metadata.envKey as keyof EnvConfig,
    );
    if (!expected?.trim()) {
      throw new ForbiddenException();
    }

    const request: Request = context.switchToHttp().getRequest();
    const received = request.headers[metadata.headerName.toLowerCase()];
    const token = Array.isArray(received) ? received[0] : received;

    if (!safeEqual(token, expected)) {
      throw new ForbiddenException();
    }

    return true;
  }
}

/*
 * Comparação em tempo constante, alinhando este guard aos webhooks de pagamento
 * (Asaas/Mercado Pago) e aos workers de IA (`hmac.compare_digest`), que já
 * comparavam assim. O `!==` anterior sai no primeiro byte diferente, e a
 * diferença de tempo vaza o prefixo correto — o que transforma adivinhar um
 * token de 32 bytes de impossível em ~32 rodadas de medição.
 *
 * O comprimento continua vazando (é inevitável: `timingSafeEqual` exige buffers
 * do mesmo tamanho, e comparar tamanhos diferentes lança). Saber o TAMANHO de um
 * token aleatório não ajuda quem tenta adivinhá-lo; saber o PREFIXO ajuda, e é
 * isso que fechamos aqui.
 */
function safeEqual(received: string | undefined, expected: string): boolean {
  if (typeof received !== "string") {
    return false;
  }

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
