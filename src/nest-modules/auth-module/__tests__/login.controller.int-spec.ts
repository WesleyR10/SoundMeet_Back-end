import { Test } from "@nestjs/testing";

import { Audience } from "../../../core/audience/domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../core/audience/infra/db/in-memory/audience-in-memory.repository";
import { LoginUseCase } from "../../../core/auth/application/use-cases/login/login.use-case";
import { RegisterUseCase } from "../../../core/auth/application/use-cases/register/register.use-case";
import { AddRoleUseCase } from "../../../core/auth/application/use-cases/add-role/add-role.use-case";
import { SocialSignupUseCase } from "../../../core/auth/application/use-cases/social-signup/social-signup.use-case";
import { IEmailVerificationIssuer } from "../../../core/auth/infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderInvalidCredentialsError,
  IIdentityProviderGateway,
} from "../../../core/auth/infra/gateways/identity-provider-gateway.interface";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { AuthController } from "../auth.controller";
import { LoginDto } from "../dto/login.dto";
import { VerifyEmailService } from "../verify-email.service";

describe("AuthController login() Integration Tests", () => {
  let controller: AuthController;
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;

  beforeEach(async () => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    identityGateway = {
      createUser: jest.fn(),
      assignRealmRole: jest.fn(),
      removeRealmRole: jest.fn(),
      deleteUser: jest.fn(),
      authenticateWithPassword: jest.fn().mockResolvedValue({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 900,
        token_type: "Bearer",
      }),
      getUser: jest.fn(),
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

  function buildDto(overrides: Partial<LoginDto> = {}): LoginDto {
    const dto = new LoginDto();
    dto.email = "fulano@example.com";
    dto.password = "Senha123";
    return Object.assign(dto, overrides);
  }

  it("logs in a musician and returns tokens with the resolved profile_id", async () => {
    const musician = Musician.create({
      email: "fulano@example.com",
      name: "Fulano de Tal",
      genres: [],
      instruments: [],
    });
    await musicianRepo.insert(musician);

    const output = await controller.login(buildDto());

    expect(output.role).toBe("musician");
    expect(output.profile_id).toBe(musician.musician_id.id);
    expect(output.access_token).toBe("access-token");
  });

  it("logs in an audience member and returns tokens with the resolved profile_id", async () => {
    const audience = Audience.create({
      email: "publico@example.com",
      name: "Fulano de Tal",
    });
    await audienceRepo.insert(audience);

    const output = await controller.login(
      buildDto({ email: "publico@example.com" }),
    );

    expect(output.role).toBe("audience");
    expect(output.profile_id).toBe(audience.audience_id.id);
  });

  it("propagates UnauthorizedError when the identity provider rejects the credentials", async () => {
    identityGateway.authenticateWithPassword.mockRejectedValueOnce(
      new IdentityProviderInvalidCredentialsError(),
    );

    await expect(controller.login(buildDto())).rejects.toMatchObject({
      name: "UnauthorizedError",
    });
  });

  it("propagates UnauthorizedError when credentials are valid but no local aggregate exists", async () => {
    await expect(
      controller.login(buildDto({ email: "fantasma@example.com" })),
    ).rejects.toMatchObject({ name: "UnauthorizedError" });
  });
});
