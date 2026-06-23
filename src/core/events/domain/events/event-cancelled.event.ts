import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { EventId } from "../event.aggregate";

export type EventCancelledEventProps = {
  event_id: EventId;
  cancelled_at: Date;
};

export class EventCancelledIntegrationEvent implements IIntegrationEvent<{
  event_id: string;
  cancelled_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "event.cancelled";
  payload: { event_id: string; cancelled_at: Date };

  constructor(props: { event_id: string; cancelled_at: Date }) {
    this.payload = props;
  }
}

export class EventCancelledEvent implements IDomainEvent {
  readonly aggregate_id: EventId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly cancelled_at: Date;

  constructor(props: EventCancelledEventProps) {
    this.aggregate_id = props.event_id;
    this.cancelled_at = props.cancelled_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new EventCancelledIntegrationEvent({
      event_id: this.aggregate_id.id,
      cancelled_at: this.cancelled_at,
    });
  }
}
