import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { render } from "@react-email/components";
import * as React from "react";
import { Resend } from "resend";

import { EnvConfig } from "../config-module/config.schema";
import {
  BookingCancelled,
  BookingCancelledProps,
} from "./templates/booking-cancelled";
import {
  BookingConfirmed,
  BookingConfirmedProps,
} from "./templates/booking-confirmed";
import {
  EmailChange,
  EmailChangeProps,
} from "./templates/email-change";
import {
  EmailVerification,
  EmailVerificationProps,
} from "./templates/email-verification";
import { Welcome, WelcomeProps } from "./templates/welcome";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService<EnvConfig>) {
    const apiKey = config.get<string>("RESEND_API_KEY");
    this.resend = new Resend(apiKey);
    this.from =
      config.get<string>("MAIL_FROM") ?? "noreply@soundmeet.com.br";
    this.baseUrl =
      config.get<string>("MAIL_BASE_URL") ??
      "https://api.soundmeet.com.br";
  }

  async sendEmailVerification(
    to: string,
    props: EmailVerificationProps,
  ): Promise<void> {
    await this.send(to, "Confirme seu email no SoundMeet", React.createElement(EmailVerification, props));
  }

  async sendEmailChange(to: string, props: EmailChangeProps): Promise<void> {
    await this.send(to, "Confirme seu novo email no SoundMeet", React.createElement(EmailChange, props));
  }

  async sendBookingConfirmed(
    to: string,
    props: BookingConfirmedProps,
  ): Promise<void> {
    await this.send(to, "✅ Booking confirmado no SoundMeet", React.createElement(BookingConfirmed, props));
  }

  async sendBookingCancelled(
    to: string,
    props: BookingCancelledProps,
  ): Promise<void> {
    await this.send(to, "❌ Booking cancelado no SoundMeet", React.createElement(BookingCancelled, props));
  }

  async sendWelcome(to: string, props: WelcomeProps): Promise<void> {
    await this.send(to, `Bem-vindo ao SoundMeet, ${props.name}!`, React.createElement(Welcome, props));
  }

  buildVerificationUrl(token: string): string {
    return `${this.baseUrl}/api/v1/auth/verify-email?token=${token}`;
  }

  private async send(
    to: string,
    subject: string,
    element: React.ReactElement,
  ): Promise<void> {
    try {
      const html = await render(element);
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${subject}`, error);
    }
  }
}
