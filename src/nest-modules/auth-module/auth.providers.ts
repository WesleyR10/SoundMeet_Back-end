import { ConfigService } from "@nestjs/config";

import { AudiencePrismaRepository } from "../../core/audience/infra/db/prisma/audience-prisma.repository";
import { AddRoleUseCase } from "../../core/auth/application/use-cases/add-role/add-role.use-case";
import { LoginUseCase } from "../../core/auth/application/use-cases/login/login.use-case";
import { RegisterUseCase } from "../../core/auth/application/use-cases/register/register.use-case";
import { RegisterEstablishmentUseCase } from "../../core/auth/application/use-cases/register-establishment/register-establishment.use-case";
import { SocialSignupUseCase } from "../../core/auth/application/use-cases/social-signup/social-signup.use-case";
import { KeycloakAdminGateway } from "../../core/auth/infra/gateways/keycloak-admin.gateway";
import { NoopIdentityClaimsWriter } from "../../core/auth/infra/gateways/noop-identity-claims.writer";
import { EstablishmentPrismaRepository } from "../../core/establishment/infra/db/prisma/establishment-prisma.repository";
import { MusicianPrismaRepository } from "../../core/musician/infra/db/prisma/musician-prisma.repository";
import { IIdentityClaimsWriter } from "../../core/shared/application/identity-claims.interface";
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
  // Bloco 9.1: registro de estabelecimento. Instanciado aqui (e não importado
  // de EstablishmentsModule) pelo mesmo motivo dos dois acima — evita aresta
  // de import entre AuthModule e os módulos de feature, que já custou um ciclo
  // de 3 saltos no musician-analytics-module.
  ESTABLISHMENT_PRISMA_REPOSITORY_FOR_AUTH: {
    provide: EstablishmentPrismaRepository,
    useFactory: (prismaService: PrismaService) =>
      new EstablishmentPrismaRepository(prismaService),
    inject: [PrismaService],
  },
};

export const IDENTITY_PROVIDER_GATEWAY = "IdentityProviderGateway";
export const IDENTITY_CLAIMS_WRITER = "IdentityClaimsWriter";

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
  // Só escreve claims quando a API de fato valida tokens contra o Keycloak.
  // No modo local não existe Admin API alcançável, e tentar escrever quebraria
  // a criação de estabelecimento/banda em dev.
  IDENTITY_CLAIMS_WRITER: {
    provide: IDENTITY_CLAIMS_WRITER,
    useFactory: (
      config: ConfigService<EnvConfig>,
      gateway: KeycloakAdminGateway,
    ): IIdentityClaimsWriter => {
      const mode = config.get<string>("AUTH_JWT_VALIDATION_MODE");
      const usesKeycloak = mode
        ? mode === "keycloak"
        : config.get<string>("NODE_ENV") === "production";

      return usesKeycloak ? gateway : new NoopIdentityClaimsWriter();
    },
    inject: [ConfigService, IDENTITY_PROVIDER_GATEWAY],
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
  REGISTER_ESTABLISHMENT_USE_CASE: {
    provide: RegisterEstablishmentUseCase,
    useFactory: (
      establishmentRepo: EstablishmentPrismaRepository,
      identityGateway: KeycloakAdminGateway,
      identityClaims: IIdentityClaimsWriter,
      emailVerificationIssuer: VerifyEmailService,
    ) =>
      new RegisterEstablishmentUseCase(
        establishmentRepo,
        identityGateway,
        identityClaims,
        emailVerificationIssuer,
      ),
    inject: [
      EstablishmentPrismaRepository,
      IDENTITY_PROVIDER_GATEWAY,
      IDENTITY_CLAIMS_WRITER,
      VerifyEmailService,
    ],
  },
  LOGIN_USE_CASE: {
    provide: LoginUseCase,
    useFactory: (
      musicianRepo: MusicianPrismaRepository,
      audienceRepo: AudiencePrismaRepository,
      identityGateway: KeycloakAdminGateway,
    ) => new LoginUseCase(musicianRepo, audienceRepo, identityGateway),
    inject: [
      MusicianPrismaRepository,
      AudiencePrismaRepository,
      IDENTITY_PROVIDER_GATEWAY,
    ],
  },
  SOCIAL_SIGNUP_USE_CASE: {
    provide: SocialSignupUseCase,
    useFactory: (
      musicianRepo: MusicianPrismaRepository,
      audienceRepo: AudiencePrismaRepository,
      identityGateway: KeycloakAdminGateway,
    ) => new SocialSignupUseCase(musicianRepo, audienceRepo, identityGateway),
    inject: [
      MusicianPrismaRepository,
      AudiencePrismaRepository,
      IDENTITY_PROVIDER_GATEWAY,
    ],
  },
  ADD_ROLE_USE_CASE: {
    provide: AddRoleUseCase,
    useFactory: (
      musicianRepo: MusicianPrismaRepository,
      audienceRepo: AudiencePrismaRepository,
      identityGateway: KeycloakAdminGateway,
    ) => new AddRoleUseCase(musicianRepo, audienceRepo, identityGateway),
    inject: [
      MusicianPrismaRepository,
      AudiencePrismaRepository,
      IDENTITY_PROVIDER_GATEWAY,
    ],
  },
};
