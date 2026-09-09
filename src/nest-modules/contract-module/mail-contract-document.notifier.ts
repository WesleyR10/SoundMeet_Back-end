import { Injectable } from "@nestjs/common";

import {
  ContractDocumentNotification,
  IContractDocumentNotifier,
} from "../../core/contract/application/ports/contract-document-notifier.port";
import { MailService } from "../mail-module/mail.service";

/**
 * Entrega do contrato por e-mail, com o PDF anexo.
 *
 * Adapter fino, como o do código de assinatura: traduz `role` para o
 * vocabulário do documento e delega. **Não captura erro** — a porta exige que a
 * falha chegue a quem chamou, e o use-case é quem decide relatá-la.
 */
@Injectable()
export class MailContractDocumentNotifier implements IContractDocumentNotifier {
  constructor(private readonly mail: MailService) {}

  async sendContractDocument(
    input: ContractDocumentNotification,
  ): Promise<void> {
    await this.mail.sendContractDocument(
      input.to,
      {
        partyName: input.party_name,
        roleLabel: input.role === "contractor" ? "CONTRATANTE" : "CONTRATADO",
        counterpartyName: input.counterparty_name,
        moment: input.moment,
        verificationCode: input.verification_code,
        verificationUrl: input.verification_url,
        contentHash: input.content_hash,
        showDate: input.show_date,
        localName: input.local_name,
        feeFormatted: input.fee_formatted,
      },
      input.document,
    );
  }
}
