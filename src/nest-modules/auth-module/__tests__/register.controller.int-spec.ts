import { Test } from "@nestjs/testing";

import { AudienceInMemoryRepository } from "../../../core/audience/infra/db/in-memory/audience-in-memory.repository";
import { AddRoleUseCase } from "../../../core/auth/application/use-cases/add-role/add-role.use-case";
import { LoginUseCase } from "../../../core/auth/application/use-cases/login/login.use-case";
import { RegisterUseCase } from "../../../core/auth/application/use-cases/register/register.use-case";
import { RegisterEstablishmentUseCase } from "../../../core/auth/application/use-cases/register-establishment/register-establishment.use-case";
import { SocialSignupUseCase } from "../../../core/auth/application/use-cases/social-signup/social-signup.use-case";
import { IEmailVerificationIssuer } from "../../../core/auth/infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderConflictError,
  IdentityProviderUnavailableError,
  IIdentityProviderGateway,
} from "../../../core/auth/infra/gateways/identity-provider-gateway.interface";
import { EstablishmentInMemoryRepository } from "../../../core/establishment/infra/db/in-memory/establishment-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { IIdentityClaimsWriter } from "../../../core/shared/application/identity-claims.interface";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { AuthController } from "../auth.controller";
import { RegisterDto } from "../dto/register.dto";
import { RegisterEstablishmentDto } from "../dto/register-establishment.dto";
import { VerifyEmailService } from "../verify-email.service";

describe("AuthController register() Integration Tests", () => {
  let controller: AuthController;
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let claimsWriter: jest.Mocked<IIdentityClaimsWriter>;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;

  const KEYCLOAK_USER_ID = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

  beforeEach(async () => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();
    claimsWriter = { addClaimValue: jest.fn().mockResolvedValue(undefined) };
    identityGateway = {
      createUser: jest
        .fn()
        .mockResolvedValue({ external_id: KEYCLOAK_USER_ID }),
      assignRealmRole: jest.fn().mockResolvedValue(undefined),
      removeRealmRole: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      authenticateWithPassword: jest.fn().mockResolvedValue({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 900,
        token_type: "Bearer",
      }),
      getUser: jest.fn().mockResolvedValue({
        email: "fulano@example.com",
        name: "Fulano de Tal",
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
        {
          provide: RegisterEstablishmentUseCase,
          useFactory: () =>
            new RegisterEstablishmentUseCase(
              establishmentRepo,
              identityGateway,
              claimsWriter,
              emailIssuer,
            ),
        },
        {
          provide: LoginUseCase,
          useFactory: () =>
            new LoginUseCase(musicianRepo, audienceRepo, identityGateway),
        },
        {
          provide: SocialSignupUseCase,
          useFactory: () =>
            new SocialSignupUseCase(
              musicianRepo,
              audienceRepo,
              identityGateway,
            ),
        },
        {
          provide: AddRoleUseCase,
          useFactory: () =>
            new AddRoleUseCase(musicianRepo, audienceRepo, identityGateway),
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

  describe("registerEstablishment()", () => {
    function buildEstablishmentDto(
      overrides: Partial<RegisterEstablishmentDto> = {},
    ): RegisterEstablishmentDto {
      const dto = new RegisterEstablishmentDto();
      dto.name = "Bar do Zé";
      dto.email = "contato@bardoze.com.br";
      dto.password = "Senha123";
      dto.phone = "31999998888";
      dto.establishment_type = "bar";
      return Object.assign(dto, overrides);
    }

    it("creates the establishment and returns tokens", async () => {
      const output = await controller.registerEstablishment(
        buildEstablishmentDto(),
      );

      expect(output).toMatchObject({
        access_token: "access-token",
        role: "establishment",
        needs_token_refresh: true,
      });
      expect(establishmentRepo.items).toHaveLength(1);
    });

    // Esta é a diferença estrutural entre este fluxo e o POST /auth/register:
    // músico/público têm aggregate_id == sub; estabelecimento não, e por isso
    // depende do claim para ser operável depois.
    it("uses an id different from the keycloak sub and links it via claim", async () => {
      const output = await controller.registerEstablishment(
        buildEstablishmentDto(),
      );

      expect(output.establishment_id).not.toBe(KEYCLOAK_USER_ID);
      expect(claimsWriter.addClaimValue).toHaveBeenCalledWith(
        KEYCLOAK_USER_ID,
        "establishment_ids",
        output.establishment_id,
      );
    });

    it("assigns the establishment realm role", async () => {
      await controller.registerEstablishment(buildEstablishmentDto());

      expect(identityGateway.assignRealmRole).toHaveBeenCalledWith(
        KEYCLOAK_USER_ID,
        "establishment",
      );
    });

    it("propagates ConflictError when the email is already taken", async () => {
      await controller.registerEstablishment(buildEstablishmentDto());

      await expect(
        controller.registerEstablishment(buildEstablishmentDto()),
      ).rejects.toMatchObject({ name: "ConflictError" });
      expect(establishmentRepo.items).toHaveLength(1);
    });
  });
});
