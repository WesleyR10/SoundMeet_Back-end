import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { RequestId } from "../request.aggregate";

export type RequestCreatedEventProps = {
  request_id: RequestId;
  event_id: string;
  audience_id: string;
  musician_id: string;
  song_title: string;
  artist: string | null;
  message: string | null;
  created_at: Date;
};

export class RequestCreatedEvent implements IDomainEvent {
  readonly aggregate_id: RequestId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly event_id: string;
  readonly audience_id: string;
  readonly musician_id: string;
  readonly song_title: string;
  readonly artist: string | null;
  readonly message: string | null;
  readonly created_at: Date;

  constructor(props: RequestCreatedEventProps) {
    this.aggregate_id = props.request_id;
    this.event_id = props.event_id;
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.song_title = props.song_title;
    this.artist = props.artist;
    this.message = props.message;
    this.created_at = props.created_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
