import { ConfigService } from "@nestjs/config";

import { AudiencePrismaRepository } from "../../core/audience/infra/db/prisma/audience-prisma.repository";
import { RegisterUseCase } from "../../core/auth/application/use-cases/register/register.use-case";
import { KeycloakAdminGateway } from "../../core/auth/infra/gateways/keycloak-admin.gateway";
import { MusicianPrismaRepository } from "../../core/musician/infra/db/prisma/musician-prisma.repository";
import { EnvConfig } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { VerifyEmailService } from "./verify-email.service";

export const AUTH_REPOSITORIES = {
  MUSICIAN_PRISMA_REPOSITORY_FOR_AUTH: {
    provide: MusicianPrismaRepository,
    useFactory: (prismaService: PrismaService) =>
      new MusicianPrismaRepository(prismaService),
    inject: [PrismaService],
  },
  AUDIENCE_PRISMA_REPOSITORY_FOR_AUTH: {
    provide: AudiencePrismaRepository,
    useFactory: (prismaService: PrismaService) =>
      new AudiencePrismaRepository(prismaService),
    inject: [PrismaService],
  },
};

export const IDENTITY_PROVIDER_GATEWAY = "IdentityProviderGateway";

export const AUTH_GATEWAYS = {
  IDENTITY_PROVIDER_GATEWAY: {
    provide: IDENTITY_PROVIDER_GATEWAY,
    useFactory: (config: ConfigService<EnvConfig>) =>
      new KeycloakAdminGateway({
        // KEYCLOAK_URL precisa bater com o "iss" do JWT (validação de token) e por
        // isso é mantido como o host público mesmo quando a API roda em Docker.
        // KEYCLOAK_INTERNAL_URL é o endereço realmente alcançável pelo container
        // (ex.: http://keycloak:8080) para chamadas server-to-server (Admin API e
        // Direct Access Grant) — mesma necessidade que já existe para KEYCLOAK_JWKS_URI.
        baseUrl:
          config.get<string>("KEYCLOAK_INTERNAL_URL") ??
          config.get<string>("KEYCLOAK_URL")!,
        realm: config.get<string>("KEYCLOAK_REALM")!,
        clientId: config.get<string>("KEYCLOAK_CLIENT_ID")!,
        clientSecret: config.get<string>("KEYCLOAK_CLIENT_SECRET")!,
        mobileClientId: config.get<string>("KEYCLOAK_MOBILE_CLIENT_ID")!,
      }),
    inject: [ConfigService],
  },
};

export const AUTH_USE_CASES = {
  REGISTER_USE_CASE: {
    provide: RegisterUseCase,
    useFactory: (
      musicianRepo: MusicianPrismaRepository,
      audienceRepo: AudiencePrismaRepository,
      identityGateway: KeycloakAdminGateway,
      emailVerificationIssuer: VerifyEmailService,
    ) =>
      new RegisterUseCase(
        musicianRepo,
        audienceRepo,
        identityGateway,
        emailVerificationIssuer,
      ),
    inject: [
      MusicianPrismaRepository,
      AudiencePrismaRepository,
      IDENTITY_PROVIDER_GATEWAY,
      VerifyEmailService,
    ],
  },
};
