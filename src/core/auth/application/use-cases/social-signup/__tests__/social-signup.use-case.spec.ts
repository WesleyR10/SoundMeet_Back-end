import { AudienceInMemoryRepository } from "../../../../../audience/infra/db/in-memory/audience-in-memory.repository";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { IIdentityProviderGateway } from "../../../../infra/gateways/identity-provider-gateway.interface";
import { SocialSignupInput } from "../social-signup.input";
import { SocialSignupUseCase } from "../social-signup.use-case";

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

const GOOGLE_USER_ID = "9c8d7e6f-5a4b-4c2d-8e0f-1a2b3c4d5e6f";

const baseInput = (
  role: SocialSignupInput["role"],
  overrides: Partial<SocialSignupInput> = {},
): SocialSignupInput => ({
  user_id: GOOGLE_USER_ID,
  existing_roles: [],
  role,
  ...overrides,
});

describe("SocialSignupUseCase Unit Tests", () => {
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;
  let useCase: SocialSignupUseCase;

  beforeEach(() => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    identityGateway = makeIdentityGateway();
    useCase = new SocialSignupUseCase(
      musicianRepo,
      audienceRepo,
      identityGateway,
    );

    identityGateway.getUser.mockResolvedValue({
      email: "google-user@example.com",
      name: "Google User",
    });
    identityGateway.assignRealmRole.mockResolvedValue(undefined);
  });

  it("creates an audience profile using the Keycloak sub as id", async () => {
    const output = await useCase.execute(baseInput("audience"));

    expect(output).toEqual({
      role: "audience",
      profile_id: GOOGLE_USER_ID,
    });
    expect(audienceRepo.items).toHaveLength(1);
    expect(audienceRepo.items[0].audience_id.id).toBe(GOOGLE_USER_ID);
    expect(identityGateway.assignRealmRole).toHaveBeenCalledWith(
      GOOGLE_USER_ID,
      "audience",
    );
  });

  it("creates a musician profile with cpf/phone using the Keycloak sub as id", async () => {
    const output = await useCase.execute(
      baseInput("musician", { cpf: "52998224725", phone: "11999999999" }),
    );

    expect(output.profile_id).toBe(GOOGLE_USER_ID);
    expect(musicianRepo.items).toHaveLength(1);
    expect(musicianRepo.items[0].musician_id.id).toBe(GOOGLE_USER_ID);
    expect(musicianRepo.items[0].cpf?.value).toBe("52998224725");
  });

  it("rejects with ConflictError when the token already has a profile role, without calling the identity gateway", async () => {
    await expect(
      useCase.execute(baseInput("audience", { existing_roles: ["audience"] })),
    ).rejects.toThrow(ConflictError);
    expect(identityGateway.getUser).not.toHaveBeenCalled();
  });

  it("rejects with ConflictError when cpf already exists for another musician", async () => {
    await musicianRepo.insert(
      Musician.create({
        email: "outro@example.com",
        name: "Já Existe",
        cpf: "52998224725",
        genres: [],
        instruments: [],
      }),
    );

    await expect(
      useCase.execute(
        baseInput("musician", { cpf: "52998224725", phone: "11999999999" }),
      ),
    ).rejects.toThrow(ConflictError);
    expect(identityGateway.getUser).not.toHaveBeenCalled();
  });

  it("rejects with ExternalServiceError when fetching the identity user fails", async () => {
    identityGateway.getUser.mockRejectedValue(new Error("network error"));

    await expect(useCase.execute(baseInput("audience"))).rejects.toThrow(
      ExternalServiceError,
    );
    expect(identityGateway.assignRealmRole).not.toHaveBeenCalled();
  });

  it("rejects with ExternalServiceError when assigning the realm role fails, without creating a profile", async () => {
    identityGateway.assignRealmRole.mockRejectedValue(
      new Error("keycloak down"),
    );

    await expect(useCase.execute(baseInput("audience"))).rejects.toThrow(
      ExternalServiceError,
    );
    expect(audienceRepo.items).toHaveLength(0);
  });

  it("compensates (removes the realm role) when persisting the profile fails", async () => {
    jest
      .spyOn(audienceRepo, "insert")
      .mockRejectedValueOnce(new ConflictError("Unique constraint violation"));

    await expect(useCase.execute(baseInput("audience"))).rejects.toThrow(
      ConflictError,
    );
    expect(identityGateway.removeRealmRole).toHaveBeenCalledWith(
      GOOGLE_USER_ID,
      "audience",
    );
  });

  it("throws EntityValidationError and compensates when cpf format is invalid", async () => {
    await expect(
      useCase.execute(
        baseInput("musician", { cpf: "11111111111", phone: "11999999999" }),
      ),
    ).rejects.toThrow(EntityValidationError);
    expect(identityGateway.removeRealmRole).toHaveBeenCalledWith(
      GOOGLE_USER_ID,
      "musician",
    );
    expect(musicianRepo.items).toHaveLength(0);
  });

  it("does not delete the Keycloak user when compensating (only removes the role)", async () => {
    jest
      .spyOn(audienceRepo, "insert")
      .mockRejectedValueOnce(new ConflictError("Unique constraint violation"));

    await expect(useCase.execute(baseInput("audience"))).rejects.toThrow(
      ConflictError,
    );
    expect(identityGateway.deleteUser).not.toHaveBeenCalled();
  });
});
