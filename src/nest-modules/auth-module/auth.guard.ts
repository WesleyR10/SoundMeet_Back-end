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
          // Anônimo — comportamento idêntico a não mandar token nenhum.
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
