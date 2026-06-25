import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { randomUUID } from "crypto";

import { AudienceEmailChangedEvent } from "../../core/audience/domain/events/audience-email-changed.event";
import { EstablishmentEmailChangedEvent } from "../../core/establishment/domain/events/establishment-email-changed.event";
import { MusicianEmailChangedEvent } from "../../core/musician/domain/events/musician-email-changed.event";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { MailService } from "./mail.service";

@Injectable()
export class MailEventHandler {
  private readonly logger = new Logger(MailEventHandler.name);
  private readonly TOKEN_TTL_HOURS = 24;

  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

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
