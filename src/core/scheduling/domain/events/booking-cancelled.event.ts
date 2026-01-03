import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { BookingId } from "../booking.aggregate";

export type BookingCancelledEventProps = {
  booking_id: BookingId;
  cancelled_by: "establishment" | "musician" | "band";
  reason: string | null;
  cancelled_at: Date;
  booking_start_at: Date;
};

export class BookingCancelledIntegrationEvent implements IIntegrationEvent<{
  booking_id: string;
  cancelled_by: "establishment" | "musician" | "band";
  reason: string | null;
  cancelled_at: Date;
  booking_start_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "booking.cancelled";
  payload: {
    booking_id: string;
    cancelled_by: "establishment" | "musician" | "band";
    reason: string | null;
    cancelled_at: Date;
    booking_start_at: Date;
  };

  constructor(props: {
    booking_id: string;
    cancelled_by: "establishment" | "musician" | "band";
    reason: string | null;
    cancelled_at: Date;
    booking_start_at: Date;
  }) {
    this.payload = props;
  }
}

export class BookingCancelledEvent implements IDomainEvent {
  readonly aggregate_id: BookingId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly cancelled_by: "establishment" | "musician" | "band";
  readonly reason: string | null;
  readonly cancelled_at: Date;
  readonly booking_start_at: Date;

  constructor(props: BookingCancelledEventProps) {
    this.aggregate_id = props.booking_id;
    this.cancelled_by = props.cancelled_by;
    this.reason = props.reason;
    this.cancelled_at = props.cancelled_at;
    this.booking_start_at = props.booking_start_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new BookingCancelledIntegrationEvent({
      booking_id: this.aggregate_id.id,
      cancelled_by: this.cancelled_by,
      reason: this.reason,
      cancelled_at: this.cancelled_at,
      booking_start_at: this.booking_start_at,
    });
  }
}
