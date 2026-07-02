import { Test } from "@nestjs/testing";

import { AudienceInMemoryRepository } from "../../../core/audience/infra/db/in-memory/audience-in-memory.repository";
import { RegisterUseCase } from "../../../core/auth/application/use-cases/register/register.use-case";
import { IEmailVerificationIssuer } from "../../../core/auth/infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderConflictError,
  IdentityProviderUnavailableError,
  IIdentityProviderGateway,
} from "../../../core/auth/infra/gateways/identity-provider-gateway.interface";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { AuthController } from "../auth.controller";
import { RegisterDto } from "../dto/register.dto";
import { VerifyEmailService } from "../verify-email.service";

describe("AuthController register() Integration Tests", () => {
  let controller: AuthController;
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;

  const KEYCLOAK_USER_ID = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

  beforeEach(async () => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    identityGateway = {
      createUser: jest
        .fn()
        .mockResolvedValue({ external_id: KEYCLOAK_USER_ID }),
      assignRealmRole: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      authenticateWithPassword: jest.fn().mockResolvedValue({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 900,
        token_type: "Bearer",
      }),
    };
    const emailIssuer: jest.Mocked<IEmailVerificationIssuer> = {
      issueVerificationToken: jest.fn().mockResolvedValue(undefined),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: VerifyEmailService, useValue: { verify: jest.fn() } },
        {
          provide: RegisterUseCase,
          useFactory: () =>
            new RegisterUseCase(
              musicianRepo,
              audienceRepo,
              identityGateway,
              emailIssuer,
            ),
        },
      ],
    });

    const moduleRef = await applyAuthGuardMocks(moduleBuilder).compile();

    controller = moduleRef.get(AuthController);
  });

  function buildDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
    const dto = new RegisterDto();
    dto.name = "Fulano de Tal";
    dto.email = "fulano@example.com";
    dto.password = "Senha123";
    dto.role = "musician";
    return Object.assign(dto, overrides);
  }

  it("registers a musician and returns tokens with profile_id == keycloak sub", async () => {
    const output = await controller.register(buildDto({ role: "musician" }));

    expect(output.profile_id).toBe(KEYCLOAK_USER_ID);
    expect(output.access_token).toBe("access-token");
    expect(musicianRepo.items).toHaveLength(1);
  });

  it("registers an audience and returns tokens with profile_id == keycloak sub", async () => {
    const output = await controller.register(
      buildDto({
        role: "audience",
        email: "publico@example.com",
      }),
    );

    expect(output.profile_id).toBe(KEYCLOAK_USER_ID);
    expect(audienceRepo.items).toHaveLength(1);
  });

  it("propagates ConflictError when the email is already taken in Keycloak", async () => {
    identityGateway.createUser.mockRejectedValueOnce(
      new IdentityProviderConflictError(),
    );

    await expect(
      controller.register(buildDto({ email: "duplicado@example.com" })),
    ).rejects.toMatchObject({ name: "ConflictError" });
    expect(musicianRepo.items).toHaveLength(0);
  });

  it("propagates ExternalServiceError when Keycloak is unavailable", async () => {
    identityGateway.createUser.mockRejectedValueOnce(
      new IdentityProviderUnavailableError(),
    );

    await expect(controller.register(buildDto())).rejects.toMatchObject({
      name: "ExternalServiceError",
    });
    expect(musicianRepo.items).toHaveLength(0);
  });
});
