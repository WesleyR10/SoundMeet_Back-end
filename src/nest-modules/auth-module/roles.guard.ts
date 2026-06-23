import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { IS_PUBLIC_KEY, ROLES_KEY } from "./auth.decorators";
import { AuthRole, AuthUser } from "./auth.roles";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    const requiredRoles = this.reflector.getAllAndOverride<AuthRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const request: Request = context.switchToHttp().getRequest();
    const user = (request as any).user as AuthUser | undefined;
    if (!user) {
      throw new UnauthorizedException();
    }

    const userRoles = new Set(user.roles ?? []);
    if (userRoles.has("admin")) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => userRoles.has(role));
    if (!hasRole) {
      throw new ForbiddenException();
    }

    return true;
  }
}
