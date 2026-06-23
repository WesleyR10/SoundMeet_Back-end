import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { EventId } from "../event.aggregate";

export type EventAttendeeAddedEventProps = {
  event_id: EventId;
  audience_id: string;
  current_capacity: number;
  max_capacity: number | null;
  added_at: Date;
};

export class EventAttendeeAddedIntegrationEvent implements IIntegrationEvent<{
  event_id: string;
  audience_id: string;
  current_capacity: number;
  max_capacity: number | null;
  added_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "event.attendee_added";
  payload: {
    event_id: string;
    audience_id: string;
    current_capacity: number;
    max_capacity: number | null;
    added_at: Date;
  };

  constructor(props: {
    event_id: string;
    audience_id: string;
    current_capacity: number;
    max_capacity: number | null;
    added_at: Date;
  }) {
    this.payload = props;
  }
}

export class EventAttendeeAddedEvent implements IDomainEvent {
  readonly aggregate_id: EventId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly audience_id: string;
  readonly current_capacity: number;
  readonly max_capacity: number | null;
  readonly added_at: Date;

  constructor(props: EventAttendeeAddedEventProps) {
    this.aggregate_id = props.event_id;
    this.audience_id = props.audience_id;
    this.current_capacity = props.current_capacity;
    this.max_capacity = props.max_capacity;
    this.added_at = props.added_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new EventAttendeeAddedIntegrationEvent({
      event_id: this.aggregate_id.id,
      audience_id: this.audience_id,
      current_capacity: this.current_capacity,
      max_capacity: this.max_capacity,
      added_at: this.added_at,
    });
  }
}
