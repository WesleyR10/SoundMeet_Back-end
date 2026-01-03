import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { BookingId } from "../booking.aggregate";

export type BookingCompletedEventProps = {
  booking_id: BookingId;
  completed_at: Date;
};

export class BookingCompletedIntegrationEvent implements IIntegrationEvent<{
  booking_id: string;
  completed_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "booking.completed";
  payload: { booking_id: string; completed_at: Date };

  constructor(props: { booking_id: string; completed_at: Date }) {
    this.payload = props;
  }
}

export class BookingCompletedEvent implements IDomainEvent {
  readonly aggregate_id: BookingId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly completed_at: Date;

  constructor(props: BookingCompletedEventProps) {
    this.aggregate_id = props.booking_id;
    this.completed_at = props.completed_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new BookingCompletedIntegrationEvent({
      booking_id: this.aggregate_id.id,
      completed_at: this.completed_at,
    });
  }
}
