import { Injectable } from "@nestjs/common";

import {
  IContractChallengeNotifier,
  SignatureChallengeNotification,
} from "../../core/contract/application/ports/contract-challenge-notifier.port";
import { CHALLENGE_TTL_MS } from "../../core/contract/infra/signature/cache-signature-challenge.provider";
import { MailService } from "../mail-module/mail.service";

/**
 * Entrega do código de assinatura por e-mail.
 *
 * Adapter fino: traduz o vocabulário do domínio (`role`) para o do documento
 * ("CONTRATANTE"/"CONTRATADO") e delega. Vive na camada Nest porque é onde o
 * `MailService` está — o core não conhece Resend.
 */
@Injectable()
export class MailContractChallengeNotifier implements IContractChallengeNotifier {
  constructor(private readonly mail: MailService) {}

  async sendSignatureChallenge(
    input: SignatureChallengeNotification,
  ): Promise<void> {
    await this.mail.sendContractSignatureChallenge(input.to, {
      partyName: input.party_name,
      roleLabel: input.role === "contractor" ? "CONTRATANTE" : "CONTRATADO",
      code: input.code,
      /*
       * Derivado do TTL real do provider, não uma constante repetida: mudar a
       * validade num lugar e o texto do e-mail continuar dizendo "10 minutos"
       * é o tipo de divergência que ninguém percebe até o usuário reclamar.
       */
      expiresInMinutes: Math.round(CHALLENGE_TTL_MS / 60_000),
      verificationCode: input.verification_code,
    });
  }
}
