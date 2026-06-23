import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { EventId } from "../event.aggregate";

export type EventFinishedEventProps = {
  event_id: EventId;
  finished_at: Date;
};

export class EventFinishedIntegrationEvent implements IIntegrationEvent<{
  event_id: string;
  finished_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "event.finished";
  payload: { event_id: string; finished_at: Date };

  constructor(props: { event_id: string; finished_at: Date }) {
    this.payload = props;
  }
}

export class EventFinishedEvent implements IDomainEvent {
  readonly aggregate_id: EventId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly finished_at: Date;

  constructor(props: EventFinishedEventProps) {
    this.aggregate_id = props.event_id;
    this.finished_at = props.finished_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new EventFinishedIntegrationEvent({
      event_id: this.aggregate_id.id,
      finished_at: this.finished_at,
    });
  }
}
