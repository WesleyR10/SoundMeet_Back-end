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

// "id" por último, mas ainda presente: events.controller é
// @Controller("establishments/:id/events") — ali ":id" É o estabelecimento.
const FALLBACK_PARAMS = ["establishment_id", "establishmentId", "id"] as const;

@Injectable()
export class EstablishmentOwnershipGuard implements CanActivate {
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

    const establishmentId = resolveOwnershipId(
      context,
      this.reflector,
      FALLBACK_PARAMS,
    );

    if (!currentUser.establishmentIds.includes(establishmentId)) {
      throw new ForbiddenException(
        "Você não tem permissão para operar este estabelecimento.",
      );
    }

    return true;
  }
}
