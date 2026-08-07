import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import {
  OWNERSHIP_PARAM_KEY,
  OwnershipParamOptions,
} from "./ownership-param.decorator";

/**
 * No Express 5 um route param é tipado como `string | string[]` (rotas com
 * wildcard podem capturar múltiplos segmentos). Um id de recurso é sempre
 * escalar, então tratamos array como ausente — fail-closed, coerente com o
 * resto da função.
 */
function readScalarParam(
  params: Request["params"] | undefined,
  name: string,
): string | undefined {
  const value = params?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Resolve o id do recurso que o ownership guard deve comparar com as claims.
 *
 * Ordem de resolução:
 * 1. `@OwnershipParam({ param })` ou `@OwnershipParam({ bodyKey })` na rota —
 *    fonte explícita, sempre vence.
 * 2. Fallback por convenção: `fallbackParams` em ordem (específico primeiro,
 *    "id" por último — evita a classe de bug de rota aninhada em que ":id" é
 *    outra entidade, ex.: musicians/:musician_id/repertoires/:id).
 *
 * Fail-closed: guard aplicado numa rota sem id resolvível é erro de
 * configuração — nega acesso em vez de liberar silenciosamente.
 */
export function resolveOwnershipId(
  context: ExecutionContext,
  reflector: Reflector,
  fallbackParams: readonly string[],
): string {
  const request = context.switchToHttp().getRequest<Request>();
  const options = reflector.getAllAndOverride<
    OwnershipParamOptions | undefined
  >(OWNERSHIP_PARAM_KEY, [context.getHandler(), context.getClass()]);

  if (options?.param) {
    const value = readScalarParam(request.params, options.param);
    if (!value) {
      throw new ForbiddenException(
        "Não foi possível determinar o recurso desta operação.",
      );
    }
    return value;
  }

  if (options?.bodyKey) {
    const value = (request.body as Record<string, unknown> | undefined)?.[
      options.bodyKey
    ];
    if (typeof value !== "string" || value.length === 0) {
      throw new ForbiddenException(
        "Não foi possível determinar o recurso desta operação.",
      );
    }
    return value;
  }

  for (const name of fallbackParams) {
    const value = readScalarParam(request.params, name);
    if (value) {
      return value;
    }
  }

  throw new ForbiddenException(
    "Não foi possível determinar o recurso desta operação.",
  );
}
