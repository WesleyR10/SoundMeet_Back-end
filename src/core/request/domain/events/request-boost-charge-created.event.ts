import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { RequestId } from "../request.aggregate";

export type RequestBoostChargeCreatedEventProps = {
  request_id: RequestId;
  audience_id: string;
  musician_id: string;
  song_title: string;
  amount: number;
  tip_id: string;
  charged_at: Date;
};

/**
 * O PIX do destaque nasceu — junto com o PEDIDO, desde "paga antes, destaca
 * depois" (28/set/2026).
 *
 * É o gatilho do aviso "pague agora" ao fã (socket) — que alimenta o banner de
 * pendência se ele sair da tela antes de pagar. A dedicatória **não** viaja aqui: ela só se torna pública
 * depois do pagamento (`RequestBoost.isPublic`).
 */
export class RequestBoostChargeCreatedEvent implements IDomainEvent {
  readonly event_version: number;
  readonly occurred_on: Date;
  readonly aggregate_id: RequestId;
  readonly request_id: RequestId;
  readonly audience_id: string;
  readonly musician_id: string;
  readonly song_title: string;
  readonly amount: number;
  readonly tip_id: string;
  readonly charged_at: Date;

  constructor(props: RequestBoostChargeCreatedEventProps) {
    this.aggregate_id = props.request_id;
    this.request_id = props.request_id;
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.song_title = props.song_title;
    this.amount = props.amount;
    this.tip_id = props.tip_id;
    this.charged_at = props.charged_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
