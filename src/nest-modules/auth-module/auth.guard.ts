import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { ConfigSchemaType } from "../config-module/config.schema";
import { IS_PUBLIC_KEY } from "./auth.decorators";
import { AuthUser } from "./auth.roles";
import { AuthJwtVerifier } from "./auth-jwt.verifier";

/**
 * `sub` de um token que a verificação RECUSOU, lido sem verificar nada.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE GUARDAR ALGO DE UM TOKEN INVÁLIDO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O soft-auth acima degrada token recusado para anônimo, e isso é certo para
 * dado que é igual para todo mundo. Mas há rotas `@Public()` que respondem
 * DIFERENTE para o dono — `GET /musicians/:id` devolve e-mail, telefone, CNPJ
 * e endereço só a ele. Ali a degradação era um defeito intermitente por
 * desenho: o access token dura 15 minutos, o app só renova a sessão quando
 * recebe 401, e esta rota respondia 200 com a versão PÚBLICA. O músico abria
 * o próprio perfil e via o CNPJ vazio — e salvar aquele formulário gravava
 * `cnpj: null`.
 *
 * Com este valor o handler consegue distinguir "estranho com token velho"
 * (segue recebendo a versão pública) de "o próprio dono com token velho"
 * (recebe 401, e o cliente renova e repete sozinho).
 *
 * 🔴 **Nunca use isto para AUTORIZAR.** O valor vem de um token que não passou
 * na verificação: qualquer um escreve o `sub` que quiser. Ele só pode servir
 * para RECUSAR mais (devolver 401 em vez de 200 público) — nunca para liberar
 * um dado. Forjar o `sub` de outra pessoa rende ao atacante um 401.
 */
export function readUnverifiedSub(token: string): string | undefined {
  try {
    const [, encodedPayload] = token.split(".");
    if (!encodedPayload) {
      return undefined;
    }
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtVerifier: AuthJwtVerifier,
    private readonly reflector: Reflector,
    @Inject(ConfigService)
    private readonly configService: ConfigSchemaType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request: Request = context.switchToHttp().getRequest();

    if (isPublic) {
      // Soft-auth: uma rota @Public() nunca EXIGE token, mas se um Bearer
      // válido vier junto (caso comum — o app manda o JWT em toda chamada,
      // mesmo nas públicas), popula request.user mesmo assim. Isso permite a
      // um handler diferenciar "dono/admin vendo" de "estranho/anônimo vendo"
      // sem tornar a rota autenticada (ex.: GET /musicians/:id — estranho vê
      // versão sem PII, o próprio dono continua vendo os campos completos).
      // Token ausente ou inválido aqui NUNCA lança — degrada para anônimo.
      const token = this.extractTokenFromHeader(request);
      if (token) {
        try {
          const payload = await this.jwtVerifier.verify(token);
          (request as any).user = this.normalizeUser(payload);
        } catch {
          // Anônimo — comportamento idêntico a não mandar token nenhum, com
          // uma exceção que o HANDLER decide: ver `readUnverifiedSub`.
          (request as any).rejectedTokenSub = readUnverifiedSub(token);
        }
      }
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtVerifier.verify(token);
      (request as any).user = this.normalizeUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  private normalizeUser(payload: Record<string, any>): AuthUser {
    const clientId = this.configService.get<string>("KEYCLOAK_CLIENT_ID");
    const realmRoles = payload.realm_access?.roles ?? [];
    const clientRoles =
      (clientId ? payload.resource_access?.[clientId]?.roles : undefined) ?? [];
    const explicitRoles = payload.roles ?? payload.role ?? [];
    const roles = [
      ...realmRoles,
      ...clientRoles,
      ...(Array.isArray(explicitRoles) ? explicitRoles : [explicitRoles]),
    ].filter(Boolean);

    return {
      ...payload,
      roles: [...new Set(roles)],
    };
  }
}
