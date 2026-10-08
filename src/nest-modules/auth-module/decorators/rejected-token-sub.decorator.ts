import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

/**
 * `sub` do token que o `AuthGuard` RECUSOU numa rota `@Public()` — ou
 * `undefined` quando não veio token, ou quando o token era válido.
 *
 * 🔴 Não é identidade. O valor não foi verificado e só serve para um handler
 * de representação dupla responder 401 ao próprio dono em vez de entregar a
 * versão pública do recurso dele. Ver `readUnverifiedSub` em `auth.guard.ts`.
 */
export const RejectedTokenSub = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    (
      ctx.switchToHttp().getRequest<Request>() as Request & {
        rejectedTokenSub?: string;
      }
    ).rejectedTokenSub,
);
