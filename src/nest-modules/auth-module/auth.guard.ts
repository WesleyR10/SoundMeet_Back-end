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
    if (isPublic) {
      return true;
    }

    const request: Request = context.switchToHttp().getRequest();
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
