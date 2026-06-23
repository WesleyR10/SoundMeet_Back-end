import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { EventId } from "../event.aggregate";

export type EventAttendeeRemovedEventProps = {
  event_id: EventId;
  audience_id: string;
  current_capacity: number;
  max_capacity: number | null;
  removed_at: Date;
};

export class EventAttendeeRemovedIntegrationEvent implements IIntegrationEvent<{
  event_id: string;
  audience_id: string;
  current_capacity: number;
  max_capacity: number | null;
  removed_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "event.attendee_removed";
  payload: {
    event_id: string;
    audience_id: string;
    current_capacity: number;
    max_capacity: number | null;
    removed_at: Date;
  };

  constructor(props: {
    event_id: string;
    audience_id: string;
    current_capacity: number;
    max_capacity: number | null;
    removed_at: Date;
  }) {
    this.payload = props;
  }
}

export class EventAttendeeRemovedEvent implements IDomainEvent {
  readonly aggregate_id: EventId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly audience_id: string;
  readonly current_capacity: number;
  readonly max_capacity: number | null;
  readonly removed_at: Date;

  constructor(props: EventAttendeeRemovedEventProps) {
    this.aggregate_id = props.event_id;
    this.audience_id = props.audience_id;
    this.current_capacity = props.current_capacity;
    this.max_capacity = props.max_capacity;
    this.removed_at = props.removed_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new EventAttendeeRemovedIntegrationEvent({
      event_id: this.aggregate_id.id,
      audience_id: this.audience_id,
      current_capacity: this.current_capacity,
      max_capacity: this.max_capacity,
      removed_at: this.removed_at,
    });
  }
}
