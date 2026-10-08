import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { BandId } from "../band.aggregate";

export type BandInviteRespondedEventProps = {
  band_id: BandId;
  band_name: string;
  /** Quem respondeu ao convite. */
  musician_id: string;
  instrument: string;
  /** Quem convidou e precisa saber a resposta; `null` em banda sem líder. */
  leader_musician_id: string | null;
};

abstract class BandInviteRespondedEvent implements IDomainEvent {
  readonly aggregate_id: BandId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly band_name: string;
  readonly musician_id: string;
  readonly instrument: string;
  readonly leader_musician_id: string | null;

  constructor(props: BandInviteRespondedEventProps) {
    this.aggregate_id = props.band_id;
    this.band_name = props.band_name;
    this.musician_id = props.musician_id;
    this.instrument = props.instrument;
    this.leader_musician_id = props.leader_musician_id;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}

/** O convidado aceitou: passa a ser integrante. */
export class BandInviteAcceptedEvent extends BandInviteRespondedEvent {}

/** O convidado recusou. O líder pode convidar de novo. */
export class BandInviteDeclinedEvent extends BandInviteRespondedEvent {}
