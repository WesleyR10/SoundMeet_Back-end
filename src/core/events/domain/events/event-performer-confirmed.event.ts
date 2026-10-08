import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export type EventPerformerConfirmedEventProps = {
  event_musician_id: Uuid;
  event_id: string;
  musician_id: string | null;
  band_id: string | null;
};

/**
 * Um ato passou a estar CONFIRMADO na escalação de um evento — na inclusão já
 * confirmada ou na transição `pending → confirmed`.
 *
 * Existe para avisar quem segue o músico (Bloco 19.B). Reconfirmar um ato já
 * confirmado não emite: seria o mesmo fato duas vezes.
 */
export class EventPerformerConfirmedEvent implements IDomainEvent {
  readonly aggregate_id: Uuid;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly event_id: string;
  readonly musician_id: string | null;
  readonly band_id: string | null;

  constructor(props: EventPerformerConfirmedEventProps) {
    this.aggregate_id = props.event_musician_id;
    this.event_id = props.event_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
