import { IDomainEvent, Rating, Uuid } from "../../../shared/domain";

export class EstablishmentRatedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 1;

  constructor(
    public aggregate_id: Uuid,
    public rating: Rating,
    public comment: string | null,
    public rated_by: Uuid,
  ) {
    this.occurred_on = new Date();
  }

  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      rating: this.rating.value,
      comment: this.comment,
      rated_by: this.rated_by.id,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }

  static fromJSON(data: any): EstablishmentRatedEvent {
    const event = new EstablishmentRatedEvent(
      new Uuid(data.aggregate_id),
      new Rating(data.rating),
      data.comment,
      new Uuid(data.rated_by),
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
