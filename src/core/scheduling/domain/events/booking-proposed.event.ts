import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { BookingStatus } from "../../../shared/domain/value-objects/booking-status.vo";
import { BookingId } from "../booking.aggregate";

export type BookingProposedEventProps = {
  booking_id: BookingId;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  start_at: Date;
  end_at: Date;
  fee: number | null;
  status: BookingStatus;
  buffer_minutes: number;
  expires_at: Date | null;
  created_at: Date;
};

export class BookingProposedIntegrationEvent implements IIntegrationEvent<{
  booking_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  start_at: Date;
  end_at: Date;
  fee: number | null;
  status: string;
  buffer_minutes: number;
  expires_at: Date | null;
  created_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "booking.proposed";
  payload: {
    booking_id: string;
    establishment_id: string;
    musician_id: string | null;
    band_id: string | null;
    event_id: string | null;
    start_at: Date;
    end_at: Date;
    fee: number | null;
    status: string;
    buffer_minutes: number;
    expires_at: Date | null;
    created_at: Date;
  };

  constructor(props: {
    booking_id: string;
    establishment_id: string;
    musician_id: string | null;
    band_id: string | null;
    event_id: string | null;
    start_at: Date;
    end_at: Date;
    fee: number | null;
    status: string;
    buffer_minutes: number;
    expires_at: Date | null;
    created_at: Date;
  }) {
    this.payload = props;
  }
}

export class BookingProposedEvent implements IDomainEvent {
  readonly aggregate_id: BookingId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly establishment_id: string;
  readonly musician_id: string | null;
  readonly band_id: string | null;
  readonly event_id: string | null;
  readonly start_at: Date;
  readonly end_at: Date;
  readonly fee: number | null;
  readonly status: BookingStatus;
  readonly buffer_minutes: number;
  readonly expires_at: Date | null;
  readonly created_at: Date;

  constructor(props: BookingProposedEventProps) {
    this.aggregate_id = props.booking_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.event_id = props.event_id;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.fee = props.fee;
    this.status = props.status;
    this.buffer_minutes = props.buffer_minutes;
    this.expires_at = props.expires_at;
    this.created_at = props.created_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new BookingProposedIntegrationEvent({
      booking_id: this.aggregate_id.id,
      establishment_id: this.establishment_id,
      musician_id: this.musician_id,
      band_id: this.band_id,
      event_id: this.event_id,
      start_at: this.start_at,
      end_at: this.end_at,
      fee: this.fee,
      status: this.status.value,
      buffer_minutes: this.buffer_minutes,
      expires_at: this.expires_at,
      created_at: this.created_at,
    });
  }
}
