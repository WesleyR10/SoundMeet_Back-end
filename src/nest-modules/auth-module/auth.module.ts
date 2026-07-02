import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { ConfigSchemaType } from "../config-module/config.schema";
import { DatabaseModule } from "../database-module/database.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import {
  AUTH_GATEWAYS,
  AUTH_REPOSITORIES,
  AUTH_USE_CASES,
} from "./auth.providers";
import { AuthJwtVerifier } from "./auth-jwt.verifier";
import { CurrentUserContextGuard } from "./current-user-context.guard";
import { InternalTokenGuard } from "./internal-token.guard";
import { EstablishmentOwnershipGuard } from "./ownership/establishment-ownership.guard";
import { MusicianOwnershipGuard } from "./ownership/musician-ownership.guard";
import { RolesGuard } from "./roles.guard";
import { VerifyEmailService } from "./verify-email.service";

@Global()
@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigSchemaType) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") ?? "24h",
        },
      }),
      inject: [ConfigService],
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthJwtVerifier,
    AuthGuard,
    RolesGuard,
    InternalTokenGuard,
    CurrentUserContextGuard,
    EstablishmentOwnershipGuard,
    MusicianOwnershipGuard,
    VerifyEmailService,
    ...Object.values(AUTH_REPOSITORIES),
    ...Object.values(AUTH_GATEWAYS),
    ...Object.values(AUTH_USE_CASES),
  ],
  exports: [
    JwtModule,
    AuthJwtVerifier,
    AuthGuard,
    RolesGuard,
    InternalTokenGuard,
    CurrentUserContextGuard,
    EstablishmentOwnershipGuard,
    MusicianOwnershipGuard,
  ],
})
export class AuthModule {}
