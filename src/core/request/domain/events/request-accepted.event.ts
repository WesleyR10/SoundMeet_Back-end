import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export type RequestAcceptedEventProps = {
  request_id: string;
  audience_id: string;
  musician_id: string;
  song_title: string;
  occurred_on: Date;
};

export class RequestAcceptedEvent implements IDomainEvent {
  readonly event_version: number = 1;
  readonly occurred_on: Date;
  readonly aggregate_id: Uuid;
  readonly request_id: string;
  readonly audience_id: string;
  readonly musician_id: string;
  readonly song_title: string;

  constructor(props: RequestAcceptedEventProps) {
    this.request_id = props.request_id;
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.song_title = props.song_title;
    this.occurred_on = props.occurred_on;
    this.aggregate_id = new Uuid(props.request_id);
  }

  getAggregateId(): string {
    return this.request_id;
  }
}
