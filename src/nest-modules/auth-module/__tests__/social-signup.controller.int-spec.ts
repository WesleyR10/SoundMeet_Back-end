import { Test } from "@nestjs/testing";

import { AudienceInMemoryRepository } from "../../../core/audience/infra/db/in-memory/audience-in-memory.repository";
import { AddRoleUseCase } from "../../../core/auth/application/use-cases/add-role/add-role.use-case";
import { LoginUseCase } from "../../../core/auth/application/use-cases/login/login.use-case";
import { RegisterUseCase } from "../../../core/auth/application/use-cases/register/register.use-case";
import { RegisterEstablishmentUseCase } from "../../../core/auth/application/use-cases/register-establishment/register-establishment.use-case";
import { SocialSignupUseCase } from "../../../core/auth/application/use-cases/social-signup/social-signup.use-case";
import { IEmailVerificationIssuer } from "../../../core/auth/infra/gateways/email-verification-issuer.interface";
import { IIdentityProviderGateway } from "../../../core/auth/infra/gateways/identity-provider-gateway.interface";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { AuthController } from "../auth.controller";
import { SocialSignupDto } from "../dto/social-signup.dto";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { VerifyEmailService } from "../verify-email.service";

const GOOGLE_USER_ID = "9c8d7e6f-5a4b-4c2d-8e0f-1a2b3c4d5e6f";

const googleUserWithoutRole: AuthenticatedUser = {
  userId: GOOGLE_USER_ID,
  roles: [],
  establishmentIds: [],
  bandIds: [],
  isAdmin: false,
};

describe("AuthController socialSignup() Integration Tests", () => {
  let controller: AuthController;
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;

  beforeEach(async () => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    identityGateway = {
      createUser: jest.fn(),
      assignRealmRole: jest.fn().mockResolvedValue(undefined),
      removeRealmRole: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn(),
      authenticateWithPassword: jest.fn(),
      getUser: jest.fn().mockResolvedValue({
        email: "google-user@example.com",
        name: "Google User",
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
        // Não exercitado aqui — só satisfaz a injeção do AuthController.
        {
          provide: RegisterEstablishmentUseCase,
          useValue: { execute: jest.fn() },
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

  function buildDto(overrides: Partial<SocialSignupDto> = {}): SocialSignupDto {
    const dto = new SocialSignupDto();
    dto.role = "audience";
    return Object.assign(dto, overrides);
  }

  it("completes signup for an audience member authenticated via Google without a local profile yet", async () => {
    const output = await controller.socialSignup(
      buildDto({ role: "audience" }),
      googleUserWithoutRole,
    );

    expect(output).toEqual({ role: "audience", profile_id: GOOGLE_USER_ID });
    expect(audienceRepo.items).toHaveLength(1);
    expect(audienceRepo.items[0].audience_id.id).toBe(GOOGLE_USER_ID);
  });

  it("completes signup for a musician with cpf/phone", async () => {
    const output = await controller.socialSignup(
      buildDto({
        role: "musician",
        cpf: "52998224725",
        phone: "11999999999",
      }),
      googleUserWithoutRole,
    );

    expect(output.profile_id).toBe(GOOGLE_USER_ID);
    expect(musicianRepo.items).toHaveLength(1);
    expect(musicianRepo.items[0].musician_id.id).toBe(GOOGLE_USER_ID);
  });

  it("propagates ConflictError when the current token already has a profile role", async () => {
    const alreadySignedUp: AuthenticatedUser = {
      ...googleUserWithoutRole,
      roles: ["audience"],
    };

    await expect(
      controller.socialSignup(buildDto(), alreadySignedUp),
    ).rejects.toMatchObject({ name: "ConflictError" });
    expect(identityGateway.getUser).not.toHaveBeenCalled();
  });
});
