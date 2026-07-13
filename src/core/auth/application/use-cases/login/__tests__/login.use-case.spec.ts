import { AudienceInMemoryRepository } from "../../../../../audience/infra/db/in-memory/audience-in-memory.repository";
import { Audience } from "../../../../../audience/domain/audience.aggregate";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { UnauthorizedError } from "../../../../../shared/domain/errors/unauthorized.error";
import {
  IdentityProviderInvalidCredentialsError,
  IdentityProviderUnavailableError,
  IIdentityProviderGateway,
} from "../../../../infra/gateways/identity-provider-gateway.interface";
import { LoginInput } from "../login.input";
import { LoginUseCase } from "../login.use-case";

function makeIdentityGateway(): jest.Mocked<IIdentityProviderGateway> {
  return {
    createUser: jest.fn(),
    assignRealmRole: jest.fn(),
    removeRealmRole: jest.fn(),
    deleteUser: jest.fn(),
    authenticateWithPassword: jest.fn(),
    getUser: jest.fn(),
  };
}

const baseInput: LoginInput = {
  email: "fulano@example.com",
  password: "Senha123",
};

describe("LoginUseCase Unit Tests", () => {
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    identityGateway = makeIdentityGateway();
    useCase = new LoginUseCase(musicianRepo, audienceRepo, identityGateway);

    identityGateway.authenticateWithPassword.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 900,
      token_type: "Bearer",
    });
  });

  it("logs in a musician and resolves role/profile_id from the local repository", async () => {
    const musician = Musician.create({
      email: baseInput.email,
      name: "Fulano de Tal",
      genres: [],
      instruments: [],
    });
    await musicianRepo.insert(musician);

    const output = await useCase.execute(baseInput);

    expect(output).toEqual({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 900,
      token_type: "Bearer",
      role: "musician",
      profile_id: musician.musician_id.id,
    });
  });

  it("logs in an audience member and resolves role/profile_id from the local repository", async () => {
    const audience = Audience.create({
      email: baseInput.email,
      name: "Fulano de Tal",
    });
    await audienceRepo.insert(audience);

    const output = await useCase.execute(baseInput);

    expect(output.role).toBe("audience");
    expect(output.profile_id).toBe(audience.audience_id.id);
  });

  it("rejects with UnauthorizedError when the identity provider reports invalid credentials", async () => {
    identityGateway.authenticateWithPassword.mockRejectedValue(
      new IdentityProviderInvalidCredentialsError(),
    );

    await expect(useCase.execute(baseInput)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects with ExternalServiceError when the identity provider is unavailable", async () => {
    identityGateway.authenticateWithPassword.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );

    await expect(useCase.execute(baseInput)).rejects.toThrow(
      ExternalServiceError,
    );
  });

  it("rejects with UnauthorizedError when credentials are valid but no local aggregate exists", async () => {
    await expect(useCase.execute(baseInput)).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
