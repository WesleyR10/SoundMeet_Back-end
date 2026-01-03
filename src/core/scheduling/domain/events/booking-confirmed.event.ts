import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { BookingId } from "../booking.aggregate";

export type BookingConfirmedEventProps = {
  booking_id: BookingId;
  confirmed_at: Date;
};

export class BookingConfirmedIntegrationEvent implements IIntegrationEvent<{
  booking_id: string;
  confirmed_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "booking.confirmed";
  payload: { booking_id: string; confirmed_at: Date };

  constructor(props: { booking_id: string; confirmed_at: Date }) {
    this.payload = props;
  }
}

export class BookingConfirmedEvent implements IDomainEvent {
  readonly aggregate_id: BookingId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly confirmed_at: Date;

  constructor(props: BookingConfirmedEventProps) {
    this.aggregate_id = props.booking_id;
    this.confirmed_at = props.confirmed_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new BookingConfirmedIntegrationEvent({
      booking_id: this.aggregate_id.id,
      confirmed_at: this.confirmed_at,
    });
  }
}
