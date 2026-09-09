import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { CreateBookingEscrowUseCase } from "../../core/payment/application/use-cases/create-booking-escrow/create-booking-escrow.use-case";
import { BookingConfirmedEvent } from "../../core/scheduling/domain/events/booking-confirmed.event";

/**
 * Abre a custódia do cachê quando o show é confirmado (F1.3a).
 *
 * ## Por que o try/catch engole
 *
 * O `DomainEventMediator` usa `emitAsync`: um erro aqui subiria para o
 * `ConfirmBookingUseCase` **depois do booking já estar persistido**. Uma
 * indisponibilidade da instituição de pagamento passaria a derrubar a
 * confirmação de um show que já está no banco, e o estabelecimento veria erro
 * num fluxo que deu certo. Mesmo padrão e mesma justificativa de
 * `ContractIssuanceHandler`.
 *
 * A custódia é importante, mas não é pré-requisito do show: sem ela o
 * pagamento simplesmente não passa pela plataforma, e o combinado entre as
 * partes continua valendo.
 *
 * ## `payment` conhece `scheduling`, e não o contrário
 *
 * A dependência tem uma direção só, igual ao contrato: `scheduling` não sabe que
 * custódia existe. É o que permite confirmar um show sem que o subsistema
 * financeiro esteja de pé.
 */
@Injectable()
export class BookingEscrowCreationHandler {
  private readonly logger = new Logger(BookingEscrowCreationHandler.name);

  constructor(private readonly createEscrow: CreateBookingEscrowUseCase) {}

  @OnEvent(BookingConfirmedEvent.name)
  async handleBookingConfirmed(event: BookingConfirmedEvent): Promise<void> {
    const bookingId = event.aggregate_id.id;

    try {
      const output = await this.createEscrow.execute({ booking_id: bookingId });

      if (!output.created) {
        /*
         * Não é falha: é o estado do cadastro ou do acordo (show sem cachê,
         * músico sem subconta, custódia não habilitada). Fica em `warn` porque
         * é acionável — e é o sinal que diz quantos shows estão rodando sem a
         * proteção que o contrato descreve.
         */
        this.logger.warn(
          JSON.stringify({
            event: "escrow.create.skipped",
            booking_id: bookingId,
            reason: output.reason,
          }),
        );
        return;
      }

      /*
       * 🔴 Cobrança criada SEM garantia ativa no provedor.
       *
       * O dinheiro cairá liberado na subconta assim que for pago, enquanto o
       * contrato assinado afirma custódia. É `error`, não `warn`: o problema
       * não é operacional, é a plataforma afirmando em documento algo que não
       * está acontecendo — e alguém precisa ligar a Conta Escrow da subconta
       * antes do show.
       */
      if (!output.guarantee_active) {
        this.logger.error(
          JSON.stringify({
            event: "escrow.created.without_guarantee",
            booking_id: bookingId,
            escrow_id: output.escrow_id,
          }),
        );
      }

      this.logger.log(
        JSON.stringify({
          event: output.already_existed
            ? "escrow.create.already_existed"
            : "escrow.created",
          booking_id: bookingId,
          escrow_id: output.escrow_id,
          amount: output.amount,
          platform_fee: output.platform_fee,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "escrow.create.failed",
          booking_id: bookingId,
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
}
