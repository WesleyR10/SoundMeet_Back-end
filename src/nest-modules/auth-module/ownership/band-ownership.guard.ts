import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

@Injectable()
export class BandOwnershipGuard implements CanActivate {
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

    const bandId =
      request.params["id"] ??
      request.params["bandId"] ??
      request.params["band_id"];

    if (!bandId) {
      return true;
    }

    if (!currentUser.bandIds.includes(bandId)) {
      throw new ForbiddenException(
        "Você não tem permissão para operar esta banda.",
      );
    }

    return true;
  }
}
