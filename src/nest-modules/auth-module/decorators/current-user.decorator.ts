import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined =>
    ctx.switchToHttp().getRequest<Request>().currentUser,
);
