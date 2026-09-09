import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "crypto";

import { IEmailVerificationIssuer } from "../../core/auth/infra/gateways/email-verification-issuer.interface";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { MailService } from "../mail-module/mail.service";

type ProfileType = "musician" | "establishment" | "audience";

type TokenRecord = {
  type: ProfileType;
  id: string;
  email_pending: string | null;
  email_token_expires_at: Date | null;
};

/**
 * Resultado da CONSULTA de um token — não o consome.
 *
 * 🔴 Existe por causa dos scanners de link de e-mail (Gmail, Outlook Safe
 * Links, antivírus corporativo): eles fazem GET de prefetch em tudo que chega.
 * Com a confirmação num GET, o scanner queima o token de uso único ANTES do
 * usuário clicar, e ele recebe "token inválido" num link legítimo — falha que
 * parece aleatória e é impossível de reproduzir no ambiente do desenvolvedor.
 * Por isso a leitura é GET e a confirmação é POST.
 */
export type VerifyEmailPeek =
  | { status: "valid" }
  | { status: "expired" }
  | { status: "invalid" };

@Injectable()
export class VerifyEmailService implements IEmailVerificationIssuer {
  private readonly TOKEN_TTL_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // SM-016: o e-mail carrega o token em claro (é assim que o link de
  // verificação funciona), mas o banco só guarda o hash — nunca decifrado,
  // só comparado (mesma ideia de um token de reset de senha). Sem chave
  // secreta: alta entropia (randomUUID) já torna força-bruta inviável mesmo
  // com o hash vazado.
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async issueVerificationToken(type: ProfileType, id: string): Promise<void> {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_TTL_HOURS);

    const data = {
      email_token: null,
      email_token_hash: this.hashToken(token),
      email_token_expires_at: expiresAt,
    };

    const select = { name: true, email: true };

    // `establishment` entrou no Bloco 9.1: as três tabelas têm as mesmas
    // colunas de token, e `verify()` abaixo já resolvia os três tipos —
    // só a emissão estava restrita a músico/público.
    const profile =
      type === "musician"
        ? await this.prisma.musician.update({ where: { id }, data, select })
        : type === "establishment"
          ? await this.prisma.establishment.update({
              where: { id },
              data,
              select,
            })
          : await this.prisma.audience.update({ where: { id }, data, select });

    await this.mailService.sendEmailVerification(profile.email, {
      name: profile.name,
      verificationUrl: this.mailService.buildVerificationUrl(token),
    });
  }

  /**
   * URL da página do web que apresenta o resultado da verificação. Existe para
   * a rota GET legada poder redirecionar em vez de consumir o token.
   */
  buildPageUrl(token: string): string {
    return this.mailService.buildVerificationUrl(token);
  }

  async verify(token: string): Promise<{ message: string }> {
    const record = await this.findByToken(token);

    if (!record) {
      throw new NotFoundException("Token de verificação inválido ou expirado.");
    }

    if (
      record.email_token_expires_at &&
      record.email_token_expires_at < new Date()
    ) {
      throw new BadRequestException("Token de verificação expirado.");
    }

    await this.confirmEmail(record);

    return { message: "Email verificado com sucesso." };
  }

  /**
   * Diz se o token serve, SEM consumi-lo. Idempotente por construção — pode ser
   * chamado por scanner, por reload da página e pelo usuário, na ordem que for.
   */
  async peek(token: string): Promise<VerifyEmailPeek> {
    if (!token) return { status: "invalid" };

    const record = await this.findByToken(token);
    if (!record) return { status: "invalid" };

    if (
      record.email_token_expires_at &&
      record.email_token_expires_at < new Date()
    ) {
      return { status: "expired" };
    }

    return { status: "valid" };
  }

  /**
   * Reenvia o link de verificação.
   *
   * 🔴 **A resposta é a mesma para e-mail existente e inexistente.** Um "não
   * encontrado" aqui transformaria a rota — que é `@Public()` — num oráculo de
   * enumeração: qualquer pessoa descobriria quem tem conta no SoundMeet
   * testando endereços. O custo é o usuário que digitou errado não saber; a
   * alternativa é vazar a base inteira de cadastros.
   *
   * Conta já verificada também não reemite: o token novo invalidaria o estado
   * confirmado sem necessidade nenhuma.
   */
  async resend(email: string): Promise<{ message: string }> {
    const generic = {
      message:
        "Se houver uma conta pendente de confirmação para este e-mail, o link foi reenviado.",
    };

    const normalized = email.trim().toLowerCase();
    if (!normalized) return generic;

    const where = { email: normalized, email_verified_at: null };
    const select = { id: true };

    const musician = await this.prisma.musician.findFirst({ where, select });
    if (musician) {
      await this.issueVerificationToken("musician", musician.id);
      return generic;
    }

    const establishment = await this.prisma.establishment.findFirst({
      where,
      select,
    });
    if (establishment) {
      await this.issueVerificationToken("establishment", establishment.id);
      return generic;
    }

    const audience = await this.prisma.audience.findFirst({ where, select });
    if (audience) {
      await this.issueVerificationToken("audience", audience.id);
    }

    return generic;
  }

  private async findByToken(token: string): Promise<TokenRecord | null> {
    // Busca por hash (fluxo normal) OR pelo texto puro legado — cobre tokens
    // emitidos antes do backfill de email_token_hash (SM-016), que ainda têm
    // só email_token preenchido. Some com o tempo (TTL de 24h).
    const where = {
      OR: [{ email_token_hash: this.hashToken(token) }, { email_token: token }],
    };

    const musician = await this.prisma.musician.findFirst({
      where,
      select: {
        id: true,
        email_pending: true,
        email_token_expires_at: true,
      },
    });
    if (musician) {
      return {
        type: "musician",
        id: musician.id,
        email_pending: musician.email_pending,
        email_token_expires_at: musician.email_token_expires_at,
      };
    }

    const establishment = await this.prisma.establishment.findFirst({
      where,
      select: {
        id: true,
        email_pending: true,
        email_token_expires_at: true,
      },
    });
    if (establishment) {
      return {
        type: "establishment",
        id: establishment.id,
        email_pending: establishment.email_pending,
        email_token_expires_at: establishment.email_token_expires_at,
      };
    }

    const audience = await this.prisma.audience.findFirst({
      where,
      select: {
        id: true,
        email_pending: true,
        email_token_expires_at: true,
      },
    });
    if (audience) {
      return {
        type: "audience",
        id: audience.id,
        email_pending: audience.email_pending,
        email_token_expires_at: audience.email_token_expires_at,
      };
    }

    return null;
  }

  private async confirmEmail(record: TokenRecord): Promise<void> {
    const clearFields = {
      email_token: null,
      email_token_hash: null,
      email_token_expires_at: null,
      email_verified_at: new Date(),
      email_pending: null,
    };

    if (record.type === "musician") {
      await this.prisma.musician.update({
        where: { id: record.id },
        data: {
          ...(record.email_pending ? { email: record.email_pending } : {}),
          ...clearFields,
        },
      });
    } else if (record.type === "establishment") {
      await this.prisma.establishment.update({
        where: { id: record.id },
        data: {
          ...(record.email_pending ? { email: record.email_pending } : {}),
          ...clearFields,
        },
      });
    } else {
      await this.prisma.audience.update({
        where: { id: record.id },
        data: {
          ...(record.email_pending ? { email: record.email_pending } : {}),
          ...clearFields,
        },
      });
    }
  }
}
