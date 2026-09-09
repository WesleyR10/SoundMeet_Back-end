import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { randomUUID } from "crypto";

import { AudienceEmailChangedEvent } from "../../core/audience/domain/events/audience-email-changed.event";
import { EstablishmentEmailChangedEvent } from "../../core/establishment/domain/events/establishment-email-changed.event";
import { MusicianEmailChangedEvent } from "../../core/musician/domain/events/musician-email-changed.event";
import { PixKeyChangedEvent } from "../../core/payment/domain/events/pix-key-changed.event";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { MailService } from "./mail.service";

@Injectable()
export class MailEventHandler {
  private readonly logger = new Logger(MailEventHandler.name);
  private readonly TOKEN_TTL_HOURS = 24;

  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  /**
   * Chave PIX de recebimento alterada — alerta de segurança por email (A1
   * camada 2). O par do push do notifications-module: cobre quem está com o app
   * fechado ou sem push. Best-effort — falha de email nunca desfaz a troca já
   * persistida.
   */
  @OnEvent(PixKeyChangedEvent.name)
  async handlePixKeyChanged(event: PixKeyChangedEvent): Promise<void> {
    try {
      const musician = await this.prisma.musician.findUnique({
        where: { id: event.musician_id.id },
        select: { email: true, name: true },
      });
      if (!musician?.email) {
        return;
      }

      const cooldownHours =
        this.configService.get<number>("PIX_KEY_CHANGE_COOLDOWN_HOURS") ?? 24;

      await this.mailService.sendPixKeyChanged(musician.email, {
        name: musician.name ?? "músico",
        changedAt: event.occurred_on.toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        cooldownHours,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send pix-key-changed alert for musician=${event.musician_id.id}`,
        error,
      );
    }
  }

  @OnEvent(MusicianEmailChangedEvent.name)
  async handleMusicianEmailChanged(event: MusicianEmailChangedEvent) {
    const token = randomUUID();
    const expiresAt = this.expiresAt();

    await this.prisma.musician.update({
      where: { id: event.musician_id.id },
      data: {
        email_pending: event.new_email,
        email_token: token,
        email_token_expires_at: expiresAt,
      },
    });

    await this.sendEmailChangeNotification(event.new_email, event.name, token);
  }

  @OnEvent(EstablishmentEmailChangedEvent.name)
  async handleEstablishmentEmailChanged(event: EstablishmentEmailChangedEvent) {
    const token = randomUUID();
    const expiresAt = this.expiresAt();

    await this.prisma.establishment.update({
      where: { id: event.establishment_id.id },
      data: {
        email_pending: event.new_email,
        email_token: token,
        email_token_expires_at: expiresAt,
      },
    });

    await this.sendEmailChangeNotification(event.new_email, event.name, token);
  }

  @OnEvent(AudienceEmailChangedEvent.name)
  async handleAudienceEmailChanged(event: AudienceEmailChangedEvent) {
    const token = randomUUID();
    const expiresAt = this.expiresAt();

    await this.prisma.audience.update({
      where: { id: event.audience_id.id },
      data: {
        email_pending: event.new_email,
        email_token: token,
        email_token_expires_at: expiresAt,
      },
    });

    await this.sendEmailChangeNotification(event.new_email, event.name, token);
  }

  private async sendEmailChangeNotification(
    newEmail: string,
    name: string,
    token: string,
  ) {
    try {
      const confirmationUrl = this.mailService.buildVerificationUrl(token);
      await this.mailService.sendEmailChange(newEmail, {
        name,
        newEmail,
        confirmationUrl,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email change notification to ${newEmail}`,
        error,
      );
    }
  }

  private expiresAt(): Date {
    const d = new Date();
    d.setHours(d.getHours() + this.TOKEN_TTL_HOURS);
    return d;
  }
}
