import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { RequestId } from "../request.aggregate";

export type RequestBoostPaidEventProps = {
  request_id: RequestId;
  audience_id: string;
  musician_id: string;
  song_title: string;
  dedication: string | null;
  amount: number;
  tip_id: string;
};

/**
 * O destaque foi pago. É o instante em que a dedicatória vira pública.
 *
 * Diferente de `RequestBoostChargeCreatedEvent`, este evento CARREGA a
 * dedicatória — a partir daqui ela pode aparecer na tela do show, e quem
 * consome não precisa reler o pedido para saber se já pode exibi-la.
 */
export class RequestBoostPaidEvent implements IDomainEvent {
  readonly event_version: number;
  readonly occurred_on: Date;
  readonly aggregate_id: RequestId;
  readonly request_id: RequestId;
  readonly audience_id: string;
  readonly musician_id: string;
  readonly song_title: string;
  readonly dedication: string | null;
  readonly amount: number;
  readonly tip_id: string;

  constructor(props: RequestBoostPaidEventProps) {
    this.aggregate_id = props.request_id;
    this.request_id = props.request_id;
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.song_title = props.song_title;
    this.dedication = props.dedication;
    this.amount = props.amount;
    this.tip_id = props.tip_id;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
