import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";

import { AuthUser } from "./auth.roles";
import { toAuthenticatedUser } from "./authenticated-user.mapper";
import { AuthenticatedUser } from "./interfaces/authenticated-user.interface";

declare module "express" {
  interface Request {
    currentUser?: AuthenticatedUser;
  }
}

@Injectable()
export class CurrentUserContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      return true;
    }

    request.currentUser = toAuthenticatedUser(user);

    return true;
  }
}
