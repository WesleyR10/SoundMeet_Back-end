import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { IssueContractUseCase } from "../../core/contract/application/use-cases/issue-contract/issue-contract.use-case";
import { BookingConfirmedEvent } from "../../core/scheduling/domain/events/booking-confirmed.event";

/**
 * Emissão automática do contrato quando o show é confirmado.
 *
 * ## Por que o try/catch engole
 *
 * O `DomainEventMediator` usa `emitAsync`: qualquer erro aqui **sobe para o
 * `ConfirmBookingUseCase` depois do booking já estar persistido**. Uma falha de
 * renderização de PDF ou de storage passaria a derrubar a confirmação de um
 * show que já aconteceu no banco — e o cliente veria erro num fluxo que deu
 * certo. Mesmo padrão, e mesma justificativa, de
 * `google-calendar-sync-events.handler.ts` e `scheduling-events.handler.ts`.
 *
 * O contrato é importante, mas não é pré-requisito do show: quando a emissão
 * falha, a UI mostra a pendência e `POST /contracts/issue` reexecuta.
 *
 * ## Idempotência
 *
 * O evento pode ser reentregue (retomada após crash, dupla confirmação). O use
 * case consulta `findCurrentByBookingId` antes de qualquer coisa, e a unique
 * `(bookingId, revision)` no banco é a barreira real.
 */
@Injectable()
export class ContractIssuanceHandler {
  private readonly logger = new Logger(ContractIssuanceHandler.name);

  constructor(private readonly issueContract: IssueContractUseCase) {}

  @OnEvent(BookingConfirmedEvent.name)
  async handleBookingConfirmed(event: BookingConfirmedEvent): Promise<void> {
    const bookingId = event.aggregate_id.id;

    try {
      const output = await this.issueContract.execute({
        booking_id: bookingId,
        /*
         * `null` = emissão pelo sistema. É o ÚNICO caminho que pula a
         * autorização de participante, e ele é declarado aqui em código — não
         * inferido de uma lista vazia, que qualquer token sem claim produziria.
         */
        requesting_participant_ids: null,
      });

      if (!output.issued) {
        /*
         * Não é erro: é o estado do cadastro. Fica em `warn` porque é acionável
         * — alguém precisa completar o CNPJ, o CPF ou o endereço — e é o
         * sinal que diz quantos shows estão sem contrato por falta de dado.
         */
        this.logger.warn(
          JSON.stringify({
            event: "contract.issue.skipped_missing_qualification",
            booking_id: bookingId,
            missing: output.missing,
          }),
        );
        return;
      }

      this.logger.log(
        JSON.stringify({
          event: output.already_existed
            ? "contract.issue.already_existed"
            : "contract.issued",
          booking_id: bookingId,
          contract_id: output.contract.id,
          verification_code: output.contract.verification_code,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "contract.issue.failed",
          booking_id: bookingId,
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
}
