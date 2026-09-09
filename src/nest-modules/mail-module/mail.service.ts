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
  ContractDocument,
  ContractDocumentProps,
} from "./templates/contract-document";
import {
  ContractSignatureChallenge,
  ContractSignatureChallengeProps,
} from "./templates/contract-signature-challenge";
import { EmailChange, EmailChangeProps } from "./templates/email-change";
import {
  EmailVerification,
  EmailVerificationProps,
} from "./templates/email-verification";
import { PixKeyChanged, PixKeyChangedProps } from "./templates/pix-key-changed";
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
    this.from = config.get<string>("MAIL_FROM") ?? "noreply@soundmeet.com.br";
    // 🔴 `APP_URL` é a base PÚBLICA do sistema (a mesma que o QR code grava).
    //
    // Substituiu `MAIL_BASE_URL` (removida em 28/set/2026), que valia
    // `https://api.soundmeet.com.br`: o link de verificação passou a apontar
    // para a PÁGINA do web, não para a API. Com a variável antiga, o usuário
    // caía num JSON cru no navegador — exatamente o que `/verificar-email` veio
    // corrigir.
    //
    // ⚠️ Se `APP_URL` apontar para a API, o link de verificação quebra.
    this.baseUrl = config.get<string>("APP_URL") ?? "https://soundmeet.com.br";
  }

  async sendEmailVerification(
    to: string,
    props: EmailVerificationProps,
  ): Promise<void> {
    await this.send(
      to,
      "Confirme seu email no SoundMeet",
      React.createElement(EmailVerification, props),
    );
  }

  /**
   * Código de assinatura de contrato.
   *
   * ⚠️ Diferente de todos os outros e-mails desta classe, este **não pode
   * falhar em silêncio**. O `send` privado engole o erro e loga — comportamento
   * certo para um "bem-vindo", errado aqui: a parte ficaria olhando uma tela
   * pedindo um código que nunca vai chegar. Por isso o envio é feito direto,
   * com o erro propagado, e o use-case decide o que dizer ao usuário.
   */
  async sendContractSignatureChallenge(
    to: string,
    props: ContractSignatureChallengeProps,
  ): Promise<void> {
    const html = await render(
      React.createElement(ContractSignatureChallenge, props),
    );
    await this.resend.emails.send({
      from: this.from,
      to,
      /*
       * O código NÃO vai no assunto. Assunto aparece em notificação de tela
       * bloqueada e em prévia de caixa de entrada, e é registrado por
       * servidores de e-mail no caminho — para um segundo fator de assinatura,
       * a conveniência de ler sem abrir não paga o custo.
       */
      subject: `Assinatura do contrato ${props.verificationCode} — código de confirmação`,
      html,
    });
  }

  /**
   * Contrato emitido ou assinado, com o PDF anexo.
   *
   * ⚠️ Como o código de assinatura, **não passa pelo `send` privado**: a falha
   * precisa chegar a quem chamou. Se este e-mail sumir em silêncio, a cópia
   * independente do instrumento — que é metade da razão de ele existir — nunca
   * chega à parte, e ninguém fica sabendo.
   */
  async sendContractDocument(
    to: string,
    props: ContractDocumentProps,
    attachment: { filename: string; content: Buffer },
  ): Promise<void> {
    const html = await render(React.createElement(ContractDocument, props));
    const assunto =
      props.moment === "signed"
        ? `Contrato ${props.verificationCode} assinado pelas duas partes`
        : `Contrato ${props.verificationCode} emitido — pendente de assinatura`;

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: assunto,
      html,
      attachments: [
        { filename: attachment.filename, content: attachment.content },
      ],
    });
  }

  async sendEmailChange(to: string, props: EmailChangeProps): Promise<void> {
    await this.send(
      to,
      "Confirme seu novo email no SoundMeet",
      React.createElement(EmailChange, props),
    );
  }

  async sendBookingConfirmed(
    to: string,
    props: BookingConfirmedProps,
  ): Promise<void> {
    await this.send(
      to,
      "✅ Booking confirmado no SoundMeet",
      React.createElement(BookingConfirmed, props),
    );
  }

  async sendBookingCancelled(
    to: string,
    props: BookingCancelledProps,
  ): Promise<void> {
    await this.send(
      to,
      "❌ Booking cancelado no SoundMeet",
      React.createElement(BookingCancelled, props),
    );
  }

  async sendWelcome(to: string, props: WelcomeProps): Promise<void> {
    await this.send(
      to,
      `Bem-vindo ao SoundMeet, ${props.name}!`,
      React.createElement(Welcome, props),
    );
  }

  async sendPixKeyChanged(
    to: string,
    props: PixKeyChangedProps,
  ): Promise<void> {
    await this.send(
      to,
      "Alerta de segurança: sua chave PIX foi alterada",
      React.createElement(PixKeyChanged, props),
    );
  }

  /**
   * Link do e-mail de verificação → página do web.
   *
   * 🔴 A página faz um GET que apenas CONSULTA o token e confirma num POST
   * disparado pelo clique. Apontar o e-mail direto para a rota que confirma
   * (como era) entrega o token aos scanners de link que fazem prefetch — eles
   * o consomem antes do usuário, e o link legítimo passa a falhar.
   */
  buildVerificationUrl(token: string): string {
    return `${this.baseUrl}/verificar-email?token=${encodeURIComponent(token)}`;
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
