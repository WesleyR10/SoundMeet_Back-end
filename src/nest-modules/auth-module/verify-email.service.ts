import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";

import {
  EmailVerificationSubjectType,
  IEmailVerificationIssuer,
  IWelcomeNotifier,
} from "../../core/auth/infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderConflictError,
  IIdentityEmailGateway,
} from "../../core/auth/infra/gateways/identity-provider-gateway.interface";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { MailService } from "../mail-module/mail.service";

type ProfileType = "musician" | "establishment" | "audience";

type TokenRecord = {
  type: ProfileType;
  id: string;
  email: string;
  name: string;
  email_pending: string | null;
  email_verified_at: Date | null;
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
export class VerifyEmailService
  implements IEmailVerificationIssuer, IWelcomeNotifier
{
  private readonly TOKEN_TTL_HOURS = 24;
  private readonly logger = new Logger(VerifyEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    // Literal e não `IDENTITY_PROVIDER_GATEWAY`: `auth.providers.ts` importa
    // este arquivo, e importar de volta fecharia um ciclo de módulos.
    @Inject("IdentityProviderGateway")
    private readonly identity: IIdentityEmailGateway,
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

  async sendWelcome(
    type: EmailVerificationSubjectType,
    recipient: { email: string; name: string },
  ): Promise<void> {
    try {
      await this.mailService.sendWelcome(recipient.email, {
        name: recipient.name,
        role: type,
        profileUrl:
          type === "establishment"
            ? this.mailService.buildEstablishmentProfileUrl()
            : null,
      });
    } catch (error) {
      this.logger.error(
        `Boas-vindas não enviadas (${type}): ${(error as Error).message}`,
      );
    }
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

    // Primeira confirmação da conta: é aqui que o cadastro por senha passa a
    // ser utilizável. Ver `IWelcomeNotifier`. Troca de e-mail de conta já
    // confirmada não repete as boas-vindas.
    if (!record.email_verified_at) {
      await this.sendWelcome(record.type, {
        email: record.email_pending ?? record.email,
        name: record.name,
      });
    }

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
        email: true,
        name: true,
        email_pending: true,
        email_verified_at: true,
        email_token_expires_at: true,
      },
    });
    if (musician) {
      return {
        type: "musician",
        id: musician.id,
        email: musician.email,
        name: musician.name,
        email_pending: musician.email_pending,
        email_verified_at: musician.email_verified_at,
        email_token_expires_at: musician.email_token_expires_at,
      };
    }

    const establishment = await this.prisma.establishment.findFirst({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        email_pending: true,
        email_verified_at: true,
        email_token_expires_at: true,
      },
    });
    if (establishment) {
      return {
        type: "establishment",
        id: establishment.id,
        email: establishment.email,
        name: establishment.name,
        email_pending: establishment.email_pending,
        email_verified_at: establishment.email_verified_at,
        email_token_expires_at: establishment.email_token_expires_at,
      };
    }

    const audience = await this.prisma.audience.findFirst({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        email_pending: true,
        email_verified_at: true,
        email_token_expires_at: true,
      },
    });
    if (audience) {
      return {
        type: "audience",
        id: audience.id,
        email: audience.email,
        name: audience.name,
        email_pending: audience.email_pending,
        email_verified_at: audience.email_verified_at,
        email_token_expires_at: audience.email_token_expires_at,
      };
    }

    return null;
  }

  /**
   * Confirma o endereço. Para a TROCA de e-mail (`email_pending`), troca o
   * login no Keycloak ANTES do banco.
   *
   * 🔴 Até out/2026 só o banco mudava: o perfil mostrava o e-mail novo e o
   * login — e o "Esqueci a senha" — seguiam no antigo, para sempre.
   *
   * A ordem é Keycloak → banco porque o Keycloak é quem pode recusar (outra
   * conta já usa o endereço, inclusive de OUTRO tipo: músico e público são
   * usuários distintos no mesmo realm). Recusado, nada muda no banco. Se o
   * banco falhar depois, o Keycloak é revertido.
   */
  private async confirmEmail(record: TokenRecord): Promise<void> {
    const newEmail =
      record.email_pending && record.email_pending !== record.email
        ? record.email_pending
        : null;

    const identityUserId = newEmail ? this.resolveIdentityUser(record) : null;

    if (newEmail && identityUserId) {
      try {
        const updated = await this.identity.updateUserEmail(
          identityUserId,
          newEmail,
        );
        if (!updated) {
          this.logger.warn(
            `Troca de e-mail sem usuário no Keycloak: ${record.type} ${record.id}`,
          );
        }
      } catch (error) {
        if (error instanceof IdentityProviderConflictError) {
          await this.discardPendingChange(record);
          throw new ConflictException(
            "Este e-mail já está em uso por outra conta SoundMeet. Peça a troca de novo com outro endereço.",
          );
        }
        // Token preservado: o link volta a funcionar quando o Keycloak voltar.
        this.logger.error(
          `Keycloak indisponível ao confirmar troca de e-mail de ${record.type} ${record.id}: ${(error as Error).message}`,
        );
        throw new ServiceUnavailableException(
          "Não foi possível confirmar agora. Tente o mesmo link de novo em alguns minutos.",
        );
      }
    }

    try {
      await this.writeConfirmation(record, newEmail);
    } catch (error) {
      if (newEmail && identityUserId) {
        await this.identity
          .updateUserEmail(identityUserId, record.email)
          .catch((revertError: Error) =>
            this.logger.error(
              `🔴 Keycloak ficou com ${newEmail} e o banco com ${record.email} (${record.type} ${record.id}): ${revertError.message}`,
            ),
          );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        await this.discardPendingChange(record);
        throw new ConflictException(
          "Este e-mail já está em uso por outra conta SoundMeet. Peça a troca de novo com outro endereço.",
        );
      }
      throw error;
    }
  }

  /**
   * Usuário de LOGIN cujo e-mail acompanha o do perfil.
   *
   * Músico e público: o id do agregado É o `sub`, e o e-mail do perfil é o de
   * login. Estabelecimento: o e-mail é CONTATO do espaço — o painel diz isso
   * no próprio campo ("muda o contato do espaço, não o e-mail de login") —, e
   * o login é do dono, uma conta à parte. Trocar o login de quem administra a
   * casa a partir de um campo de contato abriria um caminho de tomada de conta
   * que a tela promete não existir.
   */
  private resolveIdentityUser(record: TokenRecord): string | null {
    return record.type === "establishment" ? null : record.id;
  }

  private async writeConfirmation(
    record: TokenRecord,
    newEmail: string | null,
  ): Promise<void> {
    const data = {
      ...(newEmail ? { email: newEmail } : {}),
      email_token: null,
      email_token_hash: null,
      email_token_expires_at: null,
      email_verified_at: new Date(),
      email_pending: null,
    };
    const where = { id: record.id };

    if (record.type === "musician") {
      await this.prisma.musician.update({ where, data });
    } else if (record.type === "establishment") {
      await this.prisma.establishment.update({ where, data });
    } else {
      await this.prisma.audience.update({ where, data });
    }
  }

  /** Pedido de troca que não tem como concluir: o link morre, o e-mail fica. */
  private async discardPendingChange(record: TokenRecord): Promise<void> {
    const data = {
      email_pending: null,
      email_token: null,
      email_token_hash: null,
      email_token_expires_at: null,
    };
    const where = { id: record.id };

    if (record.type === "musician") {
      await this.prisma.musician.update({ where, data });
    } else if (record.type === "establishment") {
      await this.prisma.establishment.update({ where, data });
    } else {
      await this.prisma.audience.update({ where, data });
    }
  }
}
