import { IDomainEvent, Uuid } from "../../../shared/domain";

/**
 * A custódia foi liberada — o serviço foi prestado e a remuneração passou a ser
 * devida.
 *
 * É o **único** momento em que a comissão da plataforma vira receita: a
 * cláusula `papel_da_plataforma.com_custodia` afirma que show não realizado não
 * gera comissão nenhuma. Quem escuta este evento credita a carteira do músico e
 * lança a `Transaction` de `BOOKING_FEE`.
 */
export class BookingEscrowReleasedEvent implements IDomainEvent {
  aggregate_id: Uuid;
  booking_id: Uuid;
  musician_id: Uuid | null;
  net_amount: number;
  platform_fee: number;
  released_at: Date;
  occurred_on: Date;
  event_version = 1;

  constructor(props: {
    escrow_id: Uuid;
    booking_id: Uuid;
    musician_id: Uuid | null;
    net_amount: number;
    platform_fee: number;
    released_at: Date;
  }) {
    this.aggregate_id = props.escrow_id;
    this.booking_id = props.booking_id;
    this.musician_id = props.musician_id;
    this.net_amount = props.net_amount;
    this.platform_fee = props.platform_fee;
    this.released_at = props.released_at;
    this.occurred_on = new Date();
  }

  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      booking_id: this.booking_id.id,
      musician_id: this.musician_id?.id ?? null,
      net_amount: this.net_amount,
      platform_fee: this.platform_fee,
      released_at: this.released_at.toISOString(),
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }
}
