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

const FALLBACK_PARAMS = ["band_id", "bandId", "id"] as const;

@Injectable()
export class BandOwnershipGuard implements CanActivate {
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

    const bandId = resolveOwnershipId(context, this.reflector, FALLBACK_PARAMS);

    if (!currentUser.bandIds.includes(bandId)) {
      throw new ForbiddenException(
        "Você não tem permissão para operar esta banda.",
      );
    }

    return true;
  }
}
