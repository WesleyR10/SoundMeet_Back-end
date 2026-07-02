import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";

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

@Injectable()
export class VerifyEmailService implements IEmailVerificationIssuer {
  private readonly TOKEN_TTL_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async issueVerificationToken(
    type: "musician" | "audience",
    id: string,
  ): Promise<void> {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_TTL_HOURS);

    const data = {
      email_token: token,
      email_token_expires_at: expiresAt,
    };

    const profile =
      type === "musician"
        ? await this.prisma.musician.update({
            where: { id },
            data,
            select: { name: true, email: true },
          })
        : await this.prisma.audience.update({
            where: { id },
            data,
            select: { name: true, email: true },
          });

    await this.mailService.sendEmailVerification(profile.email, {
      name: profile.name,
      verificationUrl: this.mailService.buildVerificationUrl(token),
    });
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

  private async findByToken(token: string): Promise<TokenRecord | null> {
    const musician = await this.prisma.musician.findFirst({
      where: { email_token: token },
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
      where: { email_token: token },
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
      where: { email_token: token },
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
