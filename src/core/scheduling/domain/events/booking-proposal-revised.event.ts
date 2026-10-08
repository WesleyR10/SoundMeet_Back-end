import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { BookingId } from "../booking.aggregate";

/**
 * Uma nova proposta foi feita sobre uma negociação que JÁ existia.
 *
 * Não é `BookingProposedEvent` de propósito: aquele narra o NASCIMENTO de uma
 * negociação, e o chat reage a ele abrindo conversa. Reemiti-lo aqui abriria
 * uma segunda conversa para o mesmo fio — exatamente o defeito que o
 * `from_inquiry_id` existe para evitar na conversão.
 *
 * `previous_status` fica no fato porque a MESMA operação cobre três situações
 * diferentes para quem recebe: ajuste de uma proposta ainda em aberto
 * (`pending`), reenvio depois de o prazo vencer (`expired`) e nova oferta
 * depois de uma recusa (`cancelled`). A notificação ao artista pode querer
 * dizer coisas diferentes nos três.
 */
export type BookingProposalRevisedEventProps = {
  booking_id: BookingId;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  start_at: Date;
  end_at: Date;
  fee: number | null;
  proposed_by: string;
  previous_status: string;
  expires_at: Date | null;
  revised_at: Date;
};

type BookingProposalRevisedPayload = Omit<
  BookingProposalRevisedEventProps,
  "booking_id"
> & { booking_id: string };

export class BookingProposalRevisedIntegrationEvent
  implements IIntegrationEvent<BookingProposalRevisedPayload>
{
  event_version = 1;
  occurred_on = new Date();
  event_name = "booking.proposal_revised";
  payload: BookingProposalRevisedPayload;

  constructor(props: BookingProposalRevisedPayload) {
    this.payload = props;
  }
}

export class BookingProposalRevisedEvent implements IDomainEvent {
  readonly aggregate_id: BookingId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly establishment_id: string;
  readonly musician_id: string | null;
  readonly band_id: string | null;
  readonly start_at: Date;
  readonly end_at: Date;
  readonly fee: number | null;
  readonly proposed_by: string;
  readonly previous_status: string;
  readonly expires_at: Date | null;
  readonly revised_at: Date;

  constructor(props: BookingProposalRevisedEventProps) {
    this.aggregate_id = props.booking_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.fee = props.fee;
    this.proposed_by = props.proposed_by;
    this.previous_status = props.previous_status;
    this.expires_at = props.expires_at;
    this.revised_at = props.revised_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new BookingProposalRevisedIntegrationEvent({
      booking_id: this.aggregate_id.id,
      establishment_id: this.establishment_id,
      musician_id: this.musician_id,
      band_id: this.band_id,
      start_at: this.start_at,
      end_at: this.end_at,
      fee: this.fee,
      proposed_by: this.proposed_by,
      previous_status: this.previous_status,
      expires_at: this.expires_at,
      revised_at: this.revised_at,
    });
  }
}
