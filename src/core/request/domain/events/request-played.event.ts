import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { RequestId } from "../request.aggregate";

export type RequestPlayedEventProps = {
  request_id: RequestId;
  event_id: string;
  audience_id: string;
  musician_id: string;
  song_title: string;
  played_at: Date;
};

export class RequestPlayedEvent implements IDomainEvent {
  readonly event_version: number;
  readonly occurred_on: Date;
  readonly aggregate_id: RequestId;
  readonly request_id: RequestId;
  readonly event_id: string;
  readonly audience_id: string;
  readonly musician_id: string;
  readonly song_title: string;
  readonly played_at: Date;

  constructor(props: RequestPlayedEventProps) {
    this.aggregate_id = props.request_id;
    this.request_id = props.request_id;
    this.event_id = props.event_id;
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.song_title = props.song_title;
    this.played_at = props.played_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
