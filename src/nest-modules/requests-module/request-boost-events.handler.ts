import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { TipCompletedEvent } from "../../core/payment/domain/events/tip-completed.event";
import { MarkRequestBoostPaidUseCase } from "../../core/request/application/use-cases/mark-request-boost-paid/mark-request-boost-paid.use-case";
import { RequestEventProcessingService } from "./request-event-processing.service";

/**
 * Fecha o destaque quando o pagamento é confirmado.
 *
 * ## Por que handler, e não escrita inline na confirmação da gorjeta
 *
 * `RequestPrismaRepository` não participa de `UnitOfWork`. Escrever no pedido
 * dentro de `ConfirmTipPaymentUseCase` daria aparência de transação sem a
 * garantia — e, pior, faria a confirmação de dinheiro real já aprovado no
 * provedor falhar por causa de um status secundário. Mesmo raciocínio que
 * levou `SongStartedEvent` a marcar o pedido como tocado por handler.
 *
 * ## Por que ele NÃO notifica ninguém
 *
 * 🔴 `NotificationsModule` é nó-folha: importa módulos de domínio e nunca é
 * importado por eles (a nota está no próprio módulo). Injetar o gateway aqui
 * inverteria essa direção e criaria o ciclo que a regra existe para evitar.
 * Quem avisa fã e músico é o handler de `RequestBoostPaidEvent` no
 * notifications-module — este aqui só faz o trabalho de domínio e publica o
 * evento.
 */
@Injectable()
export class RequestBoostEventsHandler {
  private readonly logger = new Logger(RequestBoostEventsHandler.name);

  constructor(
    @Inject(MarkRequestBoostPaidUseCase)
    private readonly markBoostPaid: MarkRequestBoostPaidUseCase,
    private readonly eventProcessing: RequestEventProcessingService,
  ) {}

  @OnEvent(TipCompletedEvent.name)
  async handleTipCompleted(event: TipCompletedEvent): Promise<void> {
    const tipId = event.aggregate_id.id;

    try {
      await this.eventProcessing.processOnce(`boost_paid:${tipId}`, () =>
        this.markBoostPaid.execute({
          tip_id: tipId,
          paid_at: event.occurred_on,
        }),
      );
    } catch (error) {
      /*
       * Nunca deixar o erro subir: o `TipCompletedEvent` também alimenta
       * carteira e notificação da gorjeta. Derrubar aqui poderia interromper a
       * cadeia de handlers por causa de um status de pedido.
       */
      this.logger.error(
        JSON.stringify({
          event: "request.boost.mark_paid_failed",
          tip_id: tipId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
