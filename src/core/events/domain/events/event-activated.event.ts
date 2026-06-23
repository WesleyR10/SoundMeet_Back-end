import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { EventId } from "../event.aggregate";

export type EventActivatedEventProps = {
  event_id: EventId;
  activated_at: Date;
};

export class EventActivatedIntegrationEvent implements IIntegrationEvent<{
  event_id: string;
  activated_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "event.activated";
  payload: { event_id: string; activated_at: Date };

  constructor(props: { event_id: string; activated_at: Date }) {
    this.payload = props;
  }
}

export class EventActivatedEvent implements IDomainEvent {
  readonly aggregate_id: EventId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly activated_at: Date;

  constructor(props: EventActivatedEventProps) {
    this.aggregate_id = props.event_id;
    this.activated_at = props.activated_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new EventActivatedIntegrationEvent({
      event_id: this.aggregate_id.id,
      activated_at: this.activated_at,
    });
  }
}
