import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { ConfigSchemaType } from "../config-module/config.schema";
import { AuthGuard } from "./auth.guard";
import { AuthJwtVerifier } from "./auth-jwt.verifier";
import { CurrentUserContextGuard } from "./current-user-context.guard";
import { InternalTokenGuard } from "./internal-token.guard";
import { EstablishmentOwnershipGuard } from "./ownership/establishment-ownership.guard";
import { MusicianOwnershipGuard } from "./ownership/musician-ownership.guard";
import { RolesGuard } from "./roles.guard";

@Global()
@Module({
  imports: [
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
  providers: [
    AuthJwtVerifier,
    AuthGuard,
    RolesGuard,
    InternalTokenGuard,
    CurrentUserContextGuard,
    EstablishmentOwnershipGuard,
    MusicianOwnershipGuard,
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
