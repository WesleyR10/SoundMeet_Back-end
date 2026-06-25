import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { MusicianId } from "../musician.aggregate";

export class MusicianEmailChangedEvent implements IDomainEvent {
  readonly aggregate_id: MusicianId;
  readonly occurred_on: Date;
  readonly event_version: number;
  readonly musician_id: MusicianId;
  readonly new_email: string;
  readonly name: string;

  constructor(props: {
    musician_id: MusicianId;
    new_email: string;
    name: string;
  }) {
    this.aggregate_id = props.musician_id;
    this.musician_id = props.musician_id;
    this.new_email = props.new_email;
    this.name = props.name;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
