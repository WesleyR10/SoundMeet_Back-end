import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { resolveOwnershipId } from "./resolve-ownership-id";

// "id" por último: em rota aninhada (musicians/:musician_id/...), ":id" pode
// ser outra entidade — o nome específico sempre vence (ver resolve-ownership-id).
const FALLBACK_PARAMS = ["musician_id", "musicianId", "id"] as const;

@Injectable()
export class MusicianOwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const currentUser = request.currentUser as AuthenticatedUser | undefined;

    if (!currentUser) {
      throw new ForbiddenException();
    }

    if (currentUser.isAdmin) {
      return true;
    }

    const resourceId = resolveOwnershipId(
      context,
      this.reflector,
      FALLBACK_PARAMS,
    );

    if (currentUser.userId !== resourceId) {
      throw new ForbiddenException(
        "Você não tem permissão para operar este músico.",
      );
    }

    return true;
  }
}
