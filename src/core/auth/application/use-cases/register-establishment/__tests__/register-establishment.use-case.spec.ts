import { Establishment } from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { IIdentityClaimsWriter } from "../../../../../shared/application/identity-claims.interface";
import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { IEmailVerificationIssuer } from "../../../../infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderConflictError,
  IdentityProviderUnavailableError,
  IIdentityProviderGateway,
} from "../../../../infra/gateways/identity-provider-gateway.interface";
import { RegisterEstablishmentInput } from "../register-establishment.input";
import { RegisterEstablishmentUseCase } from "../register-establishment.use-case";

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

function makeClaimsWriter(): jest.Mocked<IIdentityClaimsWriter> {
  return {
    addClaimValue: jest.fn().mockResolvedValue(undefined),
    removeClaimValue: jest.fn().mockResolvedValue(undefined),
  };
}

function makeEmailIssuer(): jest.Mocked<IEmailVerificationIssuer> {
  return { issueVerificationToken: jest.fn().mockResolvedValue(undefined) };
}

const KEYCLOAK_USER_ID = "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f";
const VALID_CNPJ = "11.222.333/0001-81";
const VALID_CNPJ_DIGITS = "11222333000181";

const baseInput = (
  overrides: Partial<RegisterEstablishmentInput> = {},
): RegisterEstablishmentInput => ({
  name: "Bar do Zé",
  email: "contato@bardoze.com.br",
  password: "Senha123",
  phone: "31999998888",
  establishment_type: "bar",
  ...overrides,
});

describe("RegisterEstablishmentUseCase Unit Tests", () => {
  let establishmentRepo: EstablishmentInMemoryRepository;
  let identityGateway: jest.Mocked<IIdentityProviderGateway>;
  let claimsWriter: jest.Mocked<IIdentityClaimsWriter>;
  let emailIssuer: jest.Mocked<IEmailVerificationIssuer>;
  let useCase: RegisterEstablishmentUseCase;

  beforeEach(() => {
    establishmentRepo = new EstablishmentInMemoryRepository();
    identityGateway = makeIdentityGateway();
    claimsWriter = makeClaimsWriter();
    emailIssuer = makeEmailIssuer();
    useCase = new RegisterEstablishmentUseCase(
      establishmentRepo,
      identityGateway,
      claimsWriter,
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

  describe("happy path", () => {
    it("cria a conta e o agregado, e devolve SÓ o establishment_id", async () => {
      const output = await useCase.execute(baseInput());

      // 🔴 AUTH-1: `toEqual` (não `toMatchObject`) de propósito — é ele que
      // faz o teste ficar vermelho se alguém reintroduzir tokens aqui.
      expect(output).toEqual({ establishment_id: expect.any(String) });

      const persisted = await establishmentRepo.findByEmail(
        "contato@bardoze.com.br",
      );
      expect(persisted).not.toBeNull();
      expect(persisted!.name).toBe("Bar do Zé");
      expect(persisted!.is_active).toBe(true);
    });

    it("should assign the establishment realm role", async () => {
      await useCase.execute(baseInput());

      expect(identityGateway.assignRealmRole).toHaveBeenCalledWith(
        KEYCLOAK_USER_ID,
        "establishment",
      );
    });

    // A invariante que separa este fluxo do RegisterUseCase: o id do agregado
    // NÃO é o sub. Quem liga a conta ao estabelecimento é o claim.
    it("should NOT use the keycloak sub as the establishment id", async () => {
      const output = await useCase.execute(baseInput());

      expect(output.establishment_id).not.toBe(KEYCLOAK_USER_ID);
    });

    it("should link the account to the establishment via establishment_ids claim", async () => {
      const output = await useCase.execute(baseInput());

      expect(claimsWriter.addClaimValue).toHaveBeenCalledWith(
        KEYCLOAK_USER_ID,
        "establishment_ids",
        output.establishment_id,
      );
    });

    it("should issue the email verification token for the establishment", async () => {
      const output = await useCase.execute(baseInput());

      expect(emailIssuer.issueVerificationToken).toHaveBeenCalledWith(
        "establishment",
        output.establishment_id,
      );
    });

    it("should use owner_name for the identity account, keeping the venue name on the aggregate", async () => {
      await useCase.execute(baseInput({ owner_name: "José da Silva" }));

      expect(identityGateway.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: "José da Silva" }),
      );

      const persisted = await establishmentRepo.findByEmail(
        "contato@bardoze.com.br",
      );
      expect(persisted!.name).toBe("Bar do Zé");
    });

    it("should fall back to the venue name when owner_name is absent", async () => {
      await useCase.execute(baseInput());

      expect(identityGateway.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Bar do Zé" }),
      );
    });
  });

  describe("duplicate checks happen before touching the identity provider", () => {
    it("should throw ConflictError when the email is already taken", async () => {
      const existing = Establishment.create({
        name: "Outro Bar",
        email: "contato@bardoze.com.br",
        establishment_type: "bar",
      });
      await establishmentRepo.insert(existing);

      await expect(useCase.execute(baseInput())).rejects.toThrow(ConflictError);
      expect(identityGateway.createUser).not.toHaveBeenCalled();
    });

    it("should throw ConflictError when the cnpj is already taken", async () => {
      const existing = Establishment.create({
        name: "Outro Bar",
        email: "outro@bar.com.br",
        cnpj: VALID_CNPJ,
        establishment_type: "bar",
      });
      await establishmentRepo.insert(existing);

      await expect(
        useCase.execute(baseInput({ cnpj: VALID_CNPJ })),
      ).rejects.toThrow(ConflictError);
      expect(identityGateway.createUser).not.toHaveBeenCalled();
    });

    it("should match the cnpj regardless of mask", async () => {
      const existing = Establishment.create({
        name: "Outro Bar",
        email: "outro@bar.com.br",
        cnpj: VALID_CNPJ,
        establishment_type: "bar",
      });
      await establishmentRepo.insert(existing);

      await expect(
        useCase.execute(baseInput({ cnpj: VALID_CNPJ_DIGITS })),
      ).rejects.toThrow(ConflictError);
    });

    // Formato inválido não é responsabilidade desta checagem — quem reporta é
    // a validação do agregado, com o campo certo (422).
    it("should defer malformed cnpj to aggregate validation, not to the conflict check", async () => {
      await expect(
        useCase.execute(baseInput({ cnpj: "00000000000000" })),
      ).rejects.toThrow(EntityValidationError);
    });

    it("should map an identity provider conflict to ConflictError", async () => {
      identityGateway.createUser.mockRejectedValue(
        new IdentityProviderConflictError(),
      );

      await expect(useCase.execute(baseInput())).rejects.toThrow(ConflictError);
    });
  });

  describe("compensation", () => {
    it("should delete the identity user when role assignment fails", async () => {
      identityGateway.assignRealmRole.mockRejectedValue(
        new IdentityProviderUnavailableError(),
      );

      await expect(useCase.execute(baseInput())).rejects.toThrow(
        ExternalServiceError,
      );
      expect(identityGateway.deleteUser).toHaveBeenCalledWith(KEYCLOAK_USER_ID);
    });

    it("should delete the identity user when writing the claim fails", async () => {
      claimsWriter.addClaimValue.mockRejectedValue(new Error("keycloak down"));

      await expect(useCase.execute(baseInput())).rejects.toThrow();
      expect(identityGateway.deleteUser).toHaveBeenCalledWith(KEYCLOAK_USER_ID);
    });

    // A ordem importa: o claim é escrito ANTES do insert justamente para não
    // deixar um estabelecimento que o dono nunca conseguiria operar.
    it("should NOT persist the establishment when the claim write fails", async () => {
      claimsWriter.addClaimValue.mockRejectedValue(new Error("keycloak down"));

      await expect(useCase.execute(baseInput())).rejects.toThrow();
      const persisted = await establishmentRepo.findByEmail(
        "contato@bardoze.com.br",
      );
      expect(persisted).toBeNull();
    });

    it("should delete the identity user when the aggregate is invalid", async () => {
      await expect(useCase.execute(baseInput({ name: "" }))).rejects.toThrow(
        EntityValidationError,
      );
      expect(identityGateway.deleteUser).toHaveBeenCalledWith(KEYCLOAK_USER_ID);
    });

    it("should not swallow the original error when compensation itself fails", async () => {
      identityGateway.assignRealmRole.mockRejectedValue(
        new IdentityProviderUnavailableError(),
      );
      identityGateway.deleteUser.mockRejectedValue(
        new Error("delete also failed"),
      );

      await expect(useCase.execute(baseInput())).rejects.toThrow(
        ExternalServiceError,
      );
    });

    /*
     * 🔴 AUTH-1: o cadastro não faz mais login automático, então não existe
     * mais "falhou só o login". Esta regressão troca de alvo: garante que
     * nenhum Direct Access Grant sobrou no caminho do cadastro.
     */
    it("NUNCA usa Direct Access Grant — o cadastro não emite tokens", async () => {
      await useCase.execute(baseInput());

      expect(identityGateway.authenticateWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("email verification is best-effort", () => {
    it("ainda devolve o establishment_id quando o e-mail de verificação falha", async () => {
      emailIssuer.issueVerificationToken.mockRejectedValue(
        new Error("smtp down"),
      );
      const warnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const output = await useCase.execute(baseInput());

      expect(output.establishment_id).toEqual(expect.any(String));
      expect(identityGateway.deleteUser).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
