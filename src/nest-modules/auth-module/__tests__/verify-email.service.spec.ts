import { BadRequestException, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";

import { VerifyEmailService } from "../verify-email.service";

function hashOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("VerifyEmailService (SM-016 email token hash)", () => {
  let prisma: any;
  let mailService: any;
  let service: VerifyEmailService;

  beforeEach(() => {
    prisma = {
      musician: { update: jest.fn(), findFirst: jest.fn() },
      establishment: { update: jest.fn(), findFirst: jest.fn() },
      audience: { update: jest.fn(), findFirst: jest.fn() },
    };
    mailService = {
      sendEmailVerification: jest.fn(),
      buildVerificationUrl: jest.fn(
        (token: string) => `https://app/verify/${token}`,
      ),
    };
    service = new VerifyEmailService(prisma, mailService);
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
});
