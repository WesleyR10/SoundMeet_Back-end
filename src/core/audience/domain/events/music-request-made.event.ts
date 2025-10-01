import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export class MusicRequestMadeEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 1;

  constructor(
    public aggregate_id: Uuid,
    public musician_id: string,
    public song_title: string,
    public artist?: string,
  ) {
    this.occurred_on = new Date();
  }

  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      musician_id: this.musician_id,
      song_title: this.song_title,
      artist: this.artist,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }

  static fromJSON(data: any): MusicRequestMadeEvent {
    const event = new MusicRequestMadeEvent(
      new Uuid(data.aggregate_id),
      data.musician_id,
      data.song_title,
      data.artist,
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
