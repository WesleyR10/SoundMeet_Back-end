import { Audience } from "../../../../../audience/domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../../audience/infra/db/in-memory/audience-in-memory.repository";
import { Musician, MusicianId } from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { IIdentityProviderGateway } from "../../../../infra/gateways/identity-provider-gateway.interface";
import { AddRoleInput } from "../add-role.input";
import { AddRoleUseCase } from "../add-role.use-case";

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

const USER_ID = "9c8d7e6f-5a4b-4c2d-8e0f-1a2b3c4d5e6f";

const baseInput = (
  role: AddRoleInput["role"],
  overrides: Partial<AddRoleInput> = {},
): AddRoleInput => ({
  user_id: USER_ID,
  existing_roles: role === "musician" ? ["audience"] : ["musician"],
  role,
  ...overrides,
});

describe("AddRoleUseCase Unit Tests", () => {
  let musicianRepo: MusicianInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;
  let useCase: AddRoleUseCase;

  beforeEach(() => {
    musicianRepo = new MusicianInMemoryRepository();
    audienceRepo = new AudienceInMemoryRepository();
    identityGateway = makeIdentityGateway();
    useCase = new AddRoleUseCase(musicianRepo, audienceRepo, identityGateway);

    identityGateway.getUser.mockResolvedValue({
      email: "user@example.com",
      name: "Multi Role User",
    });
    identityGateway.assignRealmRole.mockResolvedValue(undefined);
  });

  it("músico adiciona papel de fã: atribui role e cria o aggregate audience com o mesmo sub", async () => {
    const output = await useCase.execute(baseInput("audience"));

    expect(output).toEqual({ role: "audience", profile_id: USER_ID });
    expect(audienceRepo.items).toHaveLength(1);
    expect(audienceRepo.items[0].audience_id.id).toBe(USER_ID);
    expect(identityGateway.assignRealmRole).toHaveBeenCalledWith(
      USER_ID,
      "audience",
    );
  });

  it("fã adiciona papel de músico com cpf/phone", async () => {
    const output = await useCase.execute(
      baseInput("musician", { cpf: "52998224725", phone: "11999999999" }),
    );

    expect(output.profile_id).toBe(USER_ID);
    expect(musicianRepo.items).toHaveLength(1);
    expect(musicianRepo.items[0].cpf?.value).toBe("52998224725");
  });

  it("rejeita quando o usuário já possui o papel", async () => {
    await expect(
      useCase.execute(
        baseInput("audience", { existing_roles: ["musician", "audience"] }),
      ),
    ).rejects.toThrow(new ConflictError("Usuário já possui este papel"));
    expect(identityGateway.assignRealmRole).not.toHaveBeenCalled();
  });

  it("rejeita quando o usuário não tem cadastro inicial (caminho é o social-signup)", async () => {
    await expect(
      useCase.execute(baseInput("audience", { existing_roles: [] })),
    ).rejects.toThrow(
      new ConflictError("Usuário ainda não completou o cadastro inicial"),
    );
  });

  it("rejeita CPF já cadastrado por outro músico", async () => {
    const other = Musician.fake().aMusician().withCpf("52998224725").build();
    await musicianRepo.insert(other);

    await expect(
      useCase.execute(
        baseInput("musician", { cpf: "52998224725", phone: "11999999999" }),
      ),
    ).rejects.toThrow(new ConflictError("CPF já cadastrado"));
  });

  it("reatribui a role sem duplicar quando o aggregate já existe (reparo de estado órfão)", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withMusicianId(new MusicianId(USER_ID))
      .build();
    await musicianRepo.insert(musician);

    const output = await useCase.execute(baseInput("musician"));

    expect(output.profile_id).toBe(USER_ID);
    expect(musicianRepo.items).toHaveLength(1);
    expect(identityGateway.assignRealmRole).toHaveBeenCalledWith(
      USER_ID,
      "musician",
    );
    expect(identityGateway.getUser).not.toHaveBeenCalled();
  });

  it("compensa (remove role) quando a criação do aggregate falha", async () => {
    identityGateway.getUser.mockResolvedValue({
      email: "invalid-email",
      name: "",
    });

    await expect(useCase.execute(baseInput("audience"))).rejects.toThrow();
    expect(identityGateway.removeRealmRole).toHaveBeenCalledWith(
      USER_ID,
      "audience",
    );
    expect(audienceRepo.items).toHaveLength(0);
  });
});
