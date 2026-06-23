import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { EventId, EventStatus } from "../event.aggregate";

export type EventCreatedEventProps = {
  event_id: EventId;
  establishment_id: string;
  name: string;
  description: string | null;
  start_at: Date;
  end_at: Date;
  status: EventStatus;
  max_capacity: number | null;
  current_capacity: number;
  is_public: boolean;
  cover_charge: number | null;
  created_at: Date;
};

export class EventCreatedIntegrationEvent implements IIntegrationEvent<
  Omit<EventCreatedEventProps, "event_id"> & { event_id: string }
> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "event.created";
  payload: Omit<EventCreatedEventProps, "event_id"> & { event_id: string };

  constructor(
    props: Omit<EventCreatedEventProps, "event_id"> & { event_id: string },
  ) {
    this.payload = props;
  }
}

export class EventCreatedEvent implements IDomainEvent {
  readonly aggregate_id: EventId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly establishment_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly start_at: Date;
  readonly end_at: Date;
  readonly status: EventStatus;
  readonly max_capacity: number | null;
  readonly current_capacity: number;
  readonly is_public: boolean;
  readonly cover_charge: number | null;
  readonly created_at: Date;

  constructor(props: EventCreatedEventProps) {
    this.aggregate_id = props.event_id;
    this.establishment_id = props.establishment_id;
    this.name = props.name;
    this.description = props.description;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.status = props.status;
    this.max_capacity = props.max_capacity;
    this.current_capacity = props.current_capacity;
    this.is_public = props.is_public;
    this.cover_charge = props.cover_charge;
    this.created_at = props.created_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new EventCreatedIntegrationEvent({
      event_id: this.aggregate_id.id,
      establishment_id: this.establishment_id,
      name: this.name,
      description: this.description,
      start_at: this.start_at,
      end_at: this.end_at,
      status: this.status,
      max_capacity: this.max_capacity,
      current_capacity: this.current_capacity,
      is_public: this.is_public,
      cover_charge: this.cover_charge,
      created_at: this.created_at,
    });
  }
}
