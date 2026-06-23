import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";

import { AuthUser } from "./auth.roles";
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

    const roles = user.roles ?? [];

    request.currentUser = {
      userId: user.sub ?? "",
      roles,
      establishmentIds: (user as any).establishment_ids ?? [],
      bandIds: (user as any).band_ids ?? [],
      organizationId: (user as any).organization_id,
      isAdmin: roles.includes("admin"),
    } satisfies AuthenticatedUser;

    return true;
  }
}
