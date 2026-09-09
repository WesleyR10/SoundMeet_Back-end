import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { ContractDocumentMoment } from "../../core/contract/application/ports/contract-document-notifier.port";
import { NotifyContractPartiesUseCase } from "../../core/contract/application/use-cases/notify-contract-parties/notify-contract-parties.use-case";
import { ContractIssuedEvent } from "../../core/contract/domain/events/contract-issued.event";
import { ContractSignedEvent } from "../../core/contract/domain/events/contract-signed.event";

/**
 * Entrega o contrato às partes na emissão e no fechamento.
 *
 * ## Por que nada aqui pode estourar
 *
 * Estes handlers correm sobre eventos de domínio já publicados: o contrato
 * **está persistido**. Deixar uma falha de e-mail subir arriscaria derrubar
 * outros ouvintes do mesmo evento e faria a emissão parecer ter falhado quando
 * o instrumento existe e é válido. O e-mail é reforço probatório, não condição
 * de validade.
 *
 * ## Mas nada some em silêncio
 *
 * O use-case **relata** quem recebeu e quem não recebeu; este handler loga cada
 * falha com `contract_id`, papel e momento — o suficiente para agir. E o
 * reenvio manual (`POST /contracts/:id/document/send`) existe para que a falha
 * seja **recuperável pela própria parte**, não só visível no log.
 *
 * `ContractSignedEvent` só é emitido quando **os dois** assinaram (ver o
 * docblock do evento), então não há risco de mandar "assinado pelas duas
 * partes" no meio do caminho.
 */
@Injectable()
export class ContractDeliveryHandler {
  private readonly logger = new Logger(ContractDeliveryHandler.name);

  constructor(private readonly notifyUseCase: NotifyContractPartiesUseCase) {}

  @OnEvent(ContractIssuedEvent.name)
  async handleContractIssued(event: ContractIssuedEvent): Promise<void> {
    await this.deliver(event.aggregate_id.id, "issued");
  }

  @OnEvent(ContractSignedEvent.name)
  async handleContractSigned(event: ContractSignedEvent): Promise<void> {
    await this.deliver(event.aggregate_id.id, "signed");
  }

  private async deliver(
    contractId: string,
    moment: ContractDocumentMoment,
  ): Promise<void> {
    try {
      const output = await this.notifyUseCase.execute({
        contract_id: contractId,
        moment,
      });

      if (!output.document_available) {
        this.logger.error(
          `Contrato ${contractId} (${moment}): documento ausente no storage, nenhuma cópia enviada.`,
        );
        return;
      }

      for (const { role, reason } of output.failed) {
        this.logger.error(
          `Contrato ${contractId} (${moment}): falha ao enviar cópia para ${role} — ${reason}. Reenvio: POST /contracts/${contractId}/document/send`,
        );
      }
    } catch (error) {
      /*
       * Rede fora, storage indisponível, contrato apagado entre o evento e o
       * handler. Loga e engole: o evento não pode ser o caminho pelo qual uma
       * indisponibilidade de e-mail derruba a emissão de contratos.
       */
      this.logger.error(
        `Contrato ${contractId} (${moment}): entrega abortada — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
