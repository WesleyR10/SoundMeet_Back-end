import { AudienceInMemoryRepository } from "../../../../../audience/infra/db/in-memory/audience-in-memory.repository";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { IEmailVerificationIssuer } from "../../../../infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderConflictError,
  IdentityProviderUnavailableError,
  IIdentityProviderGateway,
} from "../../../../infra/gateways/identity-provider-gateway.interface";
import { RegisterInput } from "../register.input";
import { RegisterUseCase } from "../register.use-case";

function makeIdentityGateway(): jest.Mocked<IIdentityProviderGateway> {
  return {
    createUser: jest.fn(),
    assignRealmRole: jest.fn(),
    deleteUser: jest.fn(),
    authenticateWithPassword: jest.fn(),
  };
}

function makeEmailIssuer(): jest.Mocked<IEmailVerificationIssuer> {
  return { issueVerificationToken: jest.fn().mockResolvedValue(undefined) };
}

const KEYCLOAK_USER_ID = "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f";

const baseInput = (role: RegisterInput["role"]): RegisterInput => ({
  name: "Fulano de Tal",
  email: "fulano@example.com",
  password: "Senha123",
  role,
});

describe("RegisterUseCase Unit Tests", () => {
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;
  let emailIssuer: jest.Mocked<IEmailVerificationIssuer>;
  let useCase: RegisterUseCase;

  beforeEach(() => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    identityGateway = makeIdentityGateway();
    emailIssuer = makeEmailIssuer();
    useCase = new RegisterUseCase(
      musicianRepo,
      audienceRepo,
      identityGateway,
      emailIssuer,
    );

    identityGateway.createUser.mockResolvedValue({
      external_id: KEYCLOAK_USER_ID,
    });
    identityGateway.assignRealmRole.mockResolvedValue(undefined);
    identityGateway.authenticateWithPassword.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 900,
      token_type: "Bearer",
    });
  });

  it("should register a musician and return tokens with musician_id == keycloak sub", async () => {
    const output = await useCase.execute(baseInput("musician"));

    expect(output).toEqual({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 900,
      token_type: "Bearer",
      role: "musician",
      profile_id: KEYCLOAK_USER_ID,
    });
    expect(musicianRepo.items).toHaveLength(1);
    expect(musicianRepo.items[0].musician_id.id).toBe(KEYCLOAK_USER_ID);
    expect(identityGateway.assignRealmRole).toHaveBeenCalledWith(
      KEYCLOAK_USER_ID,
      "musician",
    );
    expect(emailIssuer.issueVerificationToken).toHaveBeenCalledWith(
      "musician",
      KEYCLOAK_USER_ID,
    );
  });

  it("should register an audience and return tokens with audience_id == keycloak sub", async () => {
    const output = await useCase.execute(baseInput("audience"));

    expect(output.profile_id).toBe(KEYCLOAK_USER_ID);
    expect(audienceRepo.items).toHaveLength(1);
    expect(audienceRepo.items[0].audience_id.id).toBe(KEYCLOAK_USER_ID);
    expect(identityGateway.assignRealmRole).toHaveBeenCalledWith(
      KEYCLOAK_USER_ID,
      "audience",
    );
  });

  it("should reject with ConflictError when email already exists locally, without calling the identity gateway", async () => {
    await musicianRepo.insert(
      Musician.create({
        email: "fulano@example.com",
        name: "Já Existe",
        genres: [],
        instruments: [],
      }),
    );

    await expect(useCase.execute(baseInput("musician"))).rejects.toThrow(
      ConflictError,
    );
    expect(identityGateway.createUser).not.toHaveBeenCalled();
  });

  it("should reject with ConflictError when Keycloak already has the email, without persisting locally", async () => {
    identityGateway.createUser.mockRejectedValue(
      new IdentityProviderConflictError(),
    );

    await expect(useCase.execute(baseInput("musician"))).rejects.toThrow(
      ConflictError,
    );
    expect(musicianRepo.items).toHaveLength(0);
  });

  it("should reject with ExternalServiceError when Keycloak is unavailable during user creation", async () => {
    identityGateway.createUser.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );

    await expect(useCase.execute(baseInput("musician"))).rejects.toThrow(
      ExternalServiceError,
    );
    expect(identityGateway.assignRealmRole).not.toHaveBeenCalled();
  });

  it("should compensate (delete the Keycloak user) when assigning the realm role fails", async () => {
    identityGateway.assignRealmRole.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );

    await expect(useCase.execute(baseInput("musician"))).rejects.toThrow(
      ExternalServiceError,
    );
    expect(identityGateway.deleteUser).toHaveBeenCalledWith(KEYCLOAK_USER_ID);
    expect(musicianRepo.items).toHaveLength(0);
  });

  it("should compensate when persisting the profile locally fails", async () => {
    jest
      .spyOn(musicianRepo, "insert")
      .mockRejectedValueOnce(new ConflictError("Unique constraint violation"));

    await expect(useCase.execute(baseInput("musician"))).rejects.toThrow(
      ConflictError,
    );
    expect(identityGateway.deleteUser).toHaveBeenCalledWith(KEYCLOAK_USER_ID);
  });

  it("should not swallow the original error when the compensation (deleteUser) also fails", async () => {
    identityGateway.assignRealmRole.mockRejectedValue(
      new IdentityProviderUnavailableError("assign role failed"),
    );
    identityGateway.deleteUser.mockRejectedValue(
      new Error("delete also failed"),
    );
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(useCase.execute(baseInput("musician"))).rejects.toThrow(
      ExternalServiceError,
    );
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should throw EntityValidationError without persisting when profile data is invalid", async () => {
    await expect(
      useCase.execute({ ...baseInput("musician"), name: "" }),
    ).rejects.toThrow(EntityValidationError);
    expect(identityGateway.deleteUser).toHaveBeenCalledWith(KEYCLOAK_USER_ID);
    expect(musicianRepo.items).toHaveLength(0);
  });

  it("should return ExternalServiceError without compensating when the automatic login fails after everything was committed", async () => {
    identityGateway.authenticateWithPassword.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );

    await expect(useCase.execute(baseInput("musician"))).rejects.toThrow(
      ExternalServiceError,
    );
    expect(identityGateway.deleteUser).not.toHaveBeenCalled();
    expect(musicianRepo.items).toHaveLength(1);
  });

  it("should not block registration when issuing the email verification token fails", async () => {
    emailIssuer.issueVerificationToken.mockRejectedValue(
      new Error("smtp down"),
    );
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const output = await useCase.execute(baseInput("musician"));

    expect(output.profile_id).toBe(KEYCLOAK_USER_ID);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
