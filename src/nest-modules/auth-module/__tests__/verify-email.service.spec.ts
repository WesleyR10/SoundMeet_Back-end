import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";

import {
  IdentityProviderConflictError,
  IdentityProviderUnavailableError,
} from "../../../core/auth/infra/gateways/identity-provider-gateway.interface";
import { VerifyEmailService } from "../verify-email.service";

function hashOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("VerifyEmailService (SM-016 email token hash)", () => {
  let prisma: any;
  let mailService: any;
  let identity: { updateUserEmail: jest.Mock };
  let service: VerifyEmailService;

  beforeEach(() => {
    prisma = {
      musician: { update: jest.fn(), findFirst: jest.fn() },
      establishment: { update: jest.fn(), findFirst: jest.fn() },
      audience: { update: jest.fn(), findFirst: jest.fn() },
    };
    mailService = {
      sendEmailVerification: jest.fn(),
      sendWelcome: jest.fn(),
      buildEstablishmentProfileUrl: jest.fn(
        () => "https://app/dashboard/perfil",
      ),
      buildVerificationUrl: jest.fn(
        (token: string) => `https://app/verify/${token}`,
      ),
    };
    identity = {
      updateUserEmail: jest.fn().mockResolvedValue(true),
    };
    service = new VerifyEmailService(prisma, mailService, identity);
  });

  describe("issueVerificationToken", () => {
    it("nunca grava o token em claro — só o hash SHA-256", async () => {
      prisma.musician.update.mockResolvedValue({
        name: "Fulano",
        email: "fulano@example.com",
      });

      await service.issueVerificationToken("musician", "musician-id-1");

      expect(prisma.musician.update).toHaveBeenCalledTimes(1);
      const call = prisma.musician.update.mock.calls[0][0];
      expect(call.data.email_token).toBeNull();
      expect(call.data.email_token_hash).toMatch(/^[0-9a-f]{64}$/);

      // O e-mail continua recebendo o token em claro (é o link clicável)
      expect(mailService.buildVerificationUrl).toHaveBeenCalledTimes(1);
      const plaintextToken = mailService.buildVerificationUrl.mock.calls[0][0];
      expect(hashOf(plaintextToken)).toBe(call.data.email_token_hash);
    });
  });

  describe("verify", () => {
    it("encontra o registro pelo hash do token recebido", async () => {
      const token = "11111111-1111-4111-8111-111111111111";
      prisma.musician.findFirst.mockResolvedValue({
        id: "musician-id-1",
        email_pending: null,
        email_token_expires_at: new Date(Date.now() + 3600_000),
      });
      prisma.musician.update.mockResolvedValue({});

      const result = await service.verify(token);

      expect(result.message).toContain("sucesso");
      const findArgs = prisma.musician.findFirst.mock.calls[0][0];
      expect(findArgs.where.OR).toEqual(
        expect.arrayContaining([{ email_token_hash: hashOf(token) }]),
      );

      const updateArgs = prisma.musician.update.mock.calls[0][0];
      expect(updateArgs.data.email_token).toBeNull();
      expect(updateArgs.data.email_token_hash).toBeNull();
    });

    it("ainda aceita tokens legados em claro (linhas pré-backfill)", async () => {
      const legacyToken = "legacy-plaintext-token";
      prisma.musician.findFirst.mockResolvedValue({
        id: "musician-id-1",
        email_pending: null,
        email_token_expires_at: new Date(Date.now() + 3600_000),
      });
      prisma.musician.update.mockResolvedValue({});

      await service.verify(legacyToken);

      const findArgs = prisma.musician.findFirst.mock.calls[0][0];
      expect(findArgs.where.OR).toEqual(
        expect.arrayContaining([{ email_token: legacyToken }]),
      );
    });

    it("rejeita token inexistente", async () => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue(null);

      await expect(service.verify("token-invalido")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejeita token expirado", async () => {
      prisma.musician.findFirst.mockResolvedValue({
        id: "musician-id-1",
        email_pending: null,
        email_token_expires_at: new Date(Date.now() - 1000),
      });

      await expect(service.verify("token-expirado")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
  describe("troca de e-mail — o login no Keycloak acompanha", () => {
    const pending = (overrides: Record<string, unknown> = {}) => ({
      id: "musician-id-1",
      email: "antigo@x.com",
      email_pending: "novo@x.com",
      email_token_expires_at: new Date(Date.now() + 3600_000),
      ...overrides,
    });

    it("🔴 troca o e-mail no Keycloak ANTES do banco (músico: id do agregado é o sub)", async () => {
      const order: string[] = [];
      identity.updateUserEmail.mockImplementation(async () => {
        order.push("keycloak");
        return true;
      });
      prisma.musician.findFirst.mockResolvedValue(pending());
      prisma.musician.update.mockImplementation(async () => {
        order.push("db");
        return {};
      });

      await service.verify("t");

      expect(identity.updateUserEmail).toHaveBeenCalledWith(
        "musician-id-1",
        "novo@x.com",
      );
      expect(order).toEqual(["keycloak", "db"]);
      expect(prisma.musician.update.mock.calls[0][0].data.email).toBe(
        "novo@x.com",
      );
    });

    it("verificação de cadastro (sem troca) não toca o Keycloak", async () => {
      prisma.musician.findFirst.mockResolvedValue(
        pending({ email_pending: null }),
      );

      await service.verify("t");

      expect(identity.updateUserEmail).not.toHaveBeenCalled();
      expect(
        prisma.musician.update.mock.calls[0][0].data.email,
      ).toBeUndefined();
    });

    it("🔴 e-mail já usado por outra conta: 409, banco intacto e pedido descartado", async () => {
      identity.updateUserEmail.mockRejectedValue(
        new IdentityProviderConflictError(),
      );
      prisma.musician.findFirst.mockResolvedValue(pending());

      await expect(service.verify("t")).rejects.toThrow(ConflictException);

      const writes = prisma.musician.update.mock.calls.map(
        (c: any) => c[0].data,
      );
      expect(writes).toHaveLength(1);
      expect(writes[0].email).toBeUndefined();
      expect(writes[0].email_verified_at).toBeUndefined();
      expect(writes[0].email_pending).toBeNull();
    });

    it("Keycloak fora do ar: 503 e NADA muda — o mesmo link funciona depois", async () => {
      identity.updateUserEmail.mockRejectedValue(
        new IdentityProviderUnavailableError(),
      );
      prisma.musician.findFirst.mockResolvedValue(pending());

      await expect(service.verify("t")).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.musician.update).not.toHaveBeenCalled();
    });

    it("banco recusa (e-mail tomado na mesma tabela): reverte o Keycloak e responde 409", async () => {
      prisma.musician.findFirst.mockResolvedValue(pending());
      prisma.musician.update
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("unique", {
            code: "P2002",
            clientVersion: "x",
          }),
        )
        .mockResolvedValue({});

      await expect(service.verify("t")).rejects.toThrow(ConflictException);

      expect(identity.updateUserEmail.mock.calls).toEqual([
        ["musician-id-1", "novo@x.com"],
        ["musician-id-1", "antigo@x.com"],
      ]);
    });

    it("🔴 estabelecimento: e-mail é CONTATO — muda no banco, o login do dono não", async () => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(
        pending({ id: "est-1" }),
      );

      await service.verify("t");

      expect(identity.updateUserEmail).not.toHaveBeenCalled();
      expect(prisma.establishment.update.mock.calls[0][0].data.email).toBe(
        "novo@x.com",
      );
    });

    it("público também tem o login trocado (id do agregado é o sub)", async () => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue(pending({ id: "aud-1" }));

      await service.verify("t");

      expect(identity.updateUserEmail).toHaveBeenCalledWith(
        "aud-1",
        "novo@x.com",
      );
    });
  });

  describe("boas-vindas na PRIMEIRA confirmação", () => {
    const record = (overrides: Record<string, unknown> = {}) => ({
      id: "a1",
      email: "fa@x.com",
      name: "Fã",
      email_pending: null,
      email_verified_at: null,
      email_token_expires_at: new Date(Date.now() + 3600_000),
      ...overrides,
    });

    beforeEach(() => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
    });

    it("envia ao confirmar o cadastro — sem botão para quem usa o app", async () => {
      prisma.audience.findFirst.mockResolvedValue(record());

      await service.verify("t");

      expect(mailService.sendWelcome).toHaveBeenCalledWith("fa@x.com", {
        name: "Fã",
        role: "audience",
        profileUrl: null,
      });
    });

    it("estabelecimento recebe o botão para o painel", async () => {
      prisma.establishment.findFirst.mockResolvedValue(
        record({ id: "e1", email: "bar@x.com", name: "Bar do Zé" }),
      );

      await service.verify("t");

      expect(mailService.sendWelcome).toHaveBeenCalledWith("bar@x.com", {
        name: "Bar do Zé",
        role: "establishment",
        profileUrl: "https://app/dashboard/perfil",
      });
    });

    it("conta já confirmada (troca de e-mail) não repete as boas-vindas", async () => {
      prisma.audience.findFirst.mockResolvedValue(
        record({ email_verified_at: new Date(), email_pending: "novo@x.com" }),
      );

      await service.verify("t");

      expect(mailService.sendWelcome).not.toHaveBeenCalled();
    });

    it("confirmação que falha não envia", async () => {
      prisma.audience.findFirst.mockResolvedValue(
        record({ email_token_expires_at: new Date(Date.now() - 1000) }),
      );

      await expect(service.verify("t")).rejects.toThrow(BadRequestException);
      expect(mailService.sendWelcome).not.toHaveBeenCalled();
    });
  });

  describe("peek — consulta sem consumir", () => {
    /*
     * 🔴 A razão de `peek` existir. Gmail, Outlook Safe Links e antivírus
     * corporativo fazem GET de prefetch em todo link que chega por e-mail. Com
     * a confirmação num GET, o scanner CONSOME o token de uso único antes do
     * usuário clicar, e o link legítimo passa a responder "inválido" — falha
     * intermitente, que não reproduz na máquina de quem desenvolve.
     *
     * Este teste fixa a propriedade que impede isso: `peek` não escreve NADA.
     */
    it("não escreve nada no banco", async () => {
      prisma.musician.findFirst.mockResolvedValue({
        id: "musician-id-1",
        email_pending: null,
        email_token_expires_at: new Date(Date.now() + 3600_000),
      });

      const result = await service.peek("token-valido");

      expect(result).toEqual({ status: "valid" });
      expect(prisma.musician.update).not.toHaveBeenCalled();
      expect(prisma.establishment.update).not.toHaveBeenCalled();
      expect(prisma.audience.update).not.toHaveBeenCalled();
    });

    it("é idempotente — duas consultas devolvem o mesmo, sem gastar o token", async () => {
      prisma.musician.findFirst.mockResolvedValue({
        id: "musician-id-1",
        email_pending: null,
        email_token_expires_at: new Date(Date.now() + 3600_000),
      });

      expect(await service.peek("t")).toEqual({ status: "valid" });
      expect(await service.peek("t")).toEqual({ status: "valid" });
      expect(prisma.musician.update).not.toHaveBeenCalled();
    });

    it("distingue expirado de inválido — a UI oferece reenvio nos dois, com textos diferentes", async () => {
      prisma.musician.findFirst.mockResolvedValue({
        id: "musician-id-1",
        email_pending: null,
        email_token_expires_at: new Date(Date.now() - 1000),
      });
      expect(await service.peek("expirado")).toEqual({ status: "expired" });

      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue(null);
      expect(await service.peek("sumiu")).toEqual({ status: "invalid" });
    });

    it("token vazio é inválido sem ir ao banco", async () => {
      expect(await service.peek("")).toEqual({ status: "invalid" });
      expect(prisma.musician.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("resend", () => {
    /*
     * 🔴 A rota é `@Public()` e anônima. Responder diferente para e-mail
     * existente e inexistente a transformaria num verificador de quem tem
     * cadastro no SoundMeet — dá para varrer uma lista inteira de endereços.
     */
    it("responde a MESMA mensagem para conta existente e inexistente", async () => {
      prisma.musician.findFirst.mockResolvedValue({ id: "m1" });
      prisma.musician.update.mockResolvedValue({ name: "F", email: "f@x.com" });
      const found = await service.resend("f@x.com");

      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue(null);
      const notFound = await service.resend("ninguem@x.com");

      expect(found.message).toBe(notFound.message);
    });

    it("não envia e-mail nenhum quando não há conta pendente", async () => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue(null);

      await service.resend("ninguem@x.com");

      expect(mailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it("só procura contas NÃO verificadas — reemitir para conta confirmada invalidaria o estado à toa", async () => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue(null);

      await service.resend("alguem@x.com");

      expect(prisma.musician.findFirst.mock.calls[0][0].where).toEqual({
        email: "alguem@x.com",
        email_verified_at: null,
      });
    });

    it("normaliza o endereço antes de procurar", async () => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue(null);

      await service.resend("  Fulano@Example.COM  ");

      expect(prisma.musician.findFirst.mock.calls[0][0].where.email).toBe(
        "fulano@example.com",
      );
    });

    it("cobre os três perfis, não só músico", async () => {
      prisma.musician.findFirst.mockResolvedValue(null);
      prisma.establishment.findFirst.mockResolvedValue(null);
      prisma.audience.findFirst.mockResolvedValue({ id: "a1" });
      prisma.audience.update.mockResolvedValue({ name: "F", email: "f@x.com" });

      await service.resend("f@x.com");

      expect(mailService.sendEmailVerification).toHaveBeenCalledTimes(1);
    });
  });
});
