import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { EnvConfig } from "../config-module/config.schema";
import {
  INTERNAL_TOKEN_KEY,
  InternalTokenMetadata,
} from "./internal-token.decorator";

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService<EnvConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }

    const metadata = this.reflector.getAllAndOverride<InternalTokenMetadata>(
      INTERNAL_TOKEN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) {
      return true;
    }

    const expected = this.configService.get<string>(
      metadata.envKey as keyof EnvConfig,
    );
    if (!expected?.trim()) {
      throw new ForbiddenException();
    }

    const request: Request = context.switchToHttp().getRequest();
    const received = request.headers[metadata.headerName.toLowerCase()];
    const token = Array.isArray(received) ? received[0] : received;

    if (token !== expected) {
      throw new ForbiddenException();
    }

    return true;
  }
}
