import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { RequestId } from "../request.aggregate";

export type RequestUpdatedEventProps = {
  request_id: RequestId;
  song_title: string;
  artist: string | null;
  message: string | null;
  updated_at: Date;
};

export class RequestUpdatedEvent implements IDomainEvent {
  readonly aggregate_id: RequestId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly song_title: string;
  readonly artist: string | null;
  readonly message: string | null;
  readonly updated_at: Date;

  constructor(props: RequestUpdatedEventProps) {
    this.aggregate_id = props.request_id;
    this.song_title = props.song_title;
    this.artist = props.artist;
    this.message = props.message;
    this.updated_at = props.updated_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
