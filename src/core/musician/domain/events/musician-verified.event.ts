import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { MusicianId } from "../musician.aggregate";

export type MusicianVerifiedEventProps = {
  musician_id: MusicianId;
  verified_at: Date;
};

export class MusicianVerifiedEvent implements IDomainEvent {
  readonly aggregate_id: MusicianId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly verified_at: Date;

  constructor(props: MusicianVerifiedEventProps) {
    this.aggregate_id = props.musician_id;
    this.verified_at = props.verified_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
