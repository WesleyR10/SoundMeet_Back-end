import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

@Injectable()
export class EstablishmentOwnershipGuard implements CanActivate {
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

    const establishmentId =
      request.params["id"] ?? request.params["establishmentId"];

    if (!establishmentId) {
      return true;
    }

    if (!currentUser.establishmentIds.includes(establishmentId)) {
      throw new ForbiddenException(
        "Você não tem permissão para operar este estabelecimento.",
      );
    }

    return true;
  }
}
