import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

@Injectable()
export class MusicianOwnershipGuard implements CanActivate {
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

    const resourceId =
      request.params["id"] ??
      request.params["musicianId"] ??
      request.params["musician_id"];

    if (!resourceId) {
      return true;
    }

    if (currentUser.userId !== resourceId) {
      throw new ForbiddenException(
        "Você não tem permissão para operar este músico.",
      );
    }

    return true;
  }
}
