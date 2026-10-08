import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { BandId } from "../band.aggregate";

export type BandMemberInvitedEventProps = {
  band_id: BandId;
  band_name: string;
  /** Quem foi convidado — o destinatário do aviso. */
  musician_id: string;
  instrument: string;
};

/**
 * Um músico foi convidado para a banda (ou reconvidado depois de recusar).
 *
 * Existe porque o convite não tinha por onde chegar: até out/2026 ele só
 * aparecia para quem abrisse "Minhas bandas" — e nem lá, porque a rota que a
 * tela consultava devolvia só vínculos aceitos.
 */
export class BandMemberInvitedEvent implements IDomainEvent {
  readonly aggregate_id: BandId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly band_name: string;
  readonly musician_id: string;
  readonly instrument: string;

  constructor(props: BandMemberInvitedEventProps) {
    this.aggregate_id = props.band_id;
    this.band_name = props.band_name;
    this.musician_id = props.musician_id;
    this.instrument = props.instrument;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
