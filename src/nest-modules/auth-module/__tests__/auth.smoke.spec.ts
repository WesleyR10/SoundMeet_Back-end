import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import { AudiencePrismaRepository } from "../../../core/audience/infra/db/prisma/audience-prisma.repository";
import { RegisterUseCase } from "../../../core/auth/application/use-cases/register/register.use-case";
import { KeycloakAdminGateway } from "../../../core/auth/infra/gateways/keycloak-admin.gateway";
import { MusicianPrismaRepository } from "../../../core/musician/infra/db/prisma/musician-prisma.repository";
import { PrismaService } from "../../database-module/prisma/prisma.service";
import { MailService } from "../../mail-module/mail.service";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { AuthController } from "../auth.controller";
import {
  AUTH_GATEWAYS,
  AUTH_REPOSITORIES,
  AUTH_USE_CASES,
  IDENTITY_PROVIDER_GATEWAY,
} from "../auth.providers";
import { VerifyEmailService } from "../verify-email.service";

describe("AuthModule — Smoke Test (DI wiring)", () => {
  let module: TestingModule;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        VerifyEmailService,
        ...Object.values(AUTH_REPOSITORIES),
        ...Object.values(AUTH_GATEWAYS),
        ...Object.values(AUTH_USE_CASES),
        { provide: PrismaService, useValue: {} },
        {
          provide: MailService,
          useValue: { sendEmailVerification: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const defaults: Record<string, unknown> = {
                KEYCLOAK_URL: "http://localhost:8080",
                KEYCLOAK_REALM: "soundmeet",
                KEYCLOAK_CLIENT_ID: "soundmeet-api",
                KEYCLOAK_CLIENT_SECRET: "test-secret",
                KEYCLOAK_MOBILE_CLIENT_ID: "soundmeet-mobile",
              };
              return defaults[key];
            }),
          },
        },
      ],
    });

    module = await applyAuthGuardMocks(moduleBuilder).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it("deve resolver AuthController sem erro de DI", () => {
    expect(module.get(AuthController)).toBeDefined();
  });

  it("deve resolver RegisterUseCase", () => {
    expect(module.get(RegisterUseCase)).toBeInstanceOf(RegisterUseCase);
  });

  it("deve resolver MusicianPrismaRepository e AudiencePrismaRepository", () => {
    expect(module.get(MusicianPrismaRepository)).toBeInstanceOf(
      MusicianPrismaRepository,
    );
    expect(module.get(AudiencePrismaRepository)).toBeInstanceOf(
      AudiencePrismaRepository,
    );
  });

  it("deve resolver o KeycloakAdminGateway com a configuração correta", () => {
    const gateway = module.get(IDENTITY_PROVIDER_GATEWAY);
    expect(gateway).toBeInstanceOf(KeycloakAdminGateway);
  });
});
