import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { RequestId } from "../request.aggregate";

export type RequestBoostRefundPendingEventProps = {
  request_id: RequestId;
  audience_id: string;
  musician_id: string;
  tip_id: string;
  amount: number;
  /** `request_rejected` (pagou e foi recusado) ou `paid_after_rejection`. */
  reason: string;
};

/**
 * Entrou dinheiro de destaque para um pedido que NÃO vai acontecer.
 *
 * 🔴 Hoje ninguém escuta este evento, de propósito: o reembolso de fato
 * (chamada ao provedor, falha quando o músico já sacou, taxas, custódia até o
 * pedido ser tocado) é tarefa aberta — `Docs/funcionalidades/reembolso-do-destaque-pago.md`.
 * O evento existe desde já para que o reembolso nasça como um handler dele,
 * sem mexer no domínio de novo. Enquanto isso, o estado `refund_pending` no
 * banco é a lista de quem precisa receber de volta.
 */
export class RequestBoostRefundPendingEvent implements IDomainEvent {
  readonly event_version: number;
  readonly occurred_on: Date;
  readonly aggregate_id: RequestId;
  readonly request_id: RequestId;
  readonly audience_id: string;
  readonly musician_id: string;
  readonly tip_id: string;
  readonly amount: number;
  readonly reason: string;

  constructor(props: RequestBoostRefundPendingEventProps) {
    this.aggregate_id = props.request_id;
    this.request_id = props.request_id;
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.tip_id = props.tip_id;
    this.amount = props.amount;
    this.reason = props.reason;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
