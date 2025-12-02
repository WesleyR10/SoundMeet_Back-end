import { IDomainEvent, Uuid, Money } from "../../../shared/domain";

export class TipCompletedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 1;
  constructor(
    public aggregate_id: Uuid,
    public amount: Money,
    public musician_id: Uuid | null,
    public audience_id: Uuid,
    public band_id: Uuid | null = null,
  ) {
    this.occurred_on = new Date();
  }
  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      amount: this.amount.amount,
      musician_id: this.musician_id?.id || null,
      audience_id: this.audience_id.id,
      band_id: this.band_id?.id || null,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }
  static fromJSON(data: any): TipCompletedEvent {
    const event = new TipCompletedEvent(
      new Uuid(data.aggregate_id),
      new Money(data.amount),
      data.musician_id ? new Uuid(data.musician_id) : null,
      new Uuid(data.audience_id),
      data.band_id ? new Uuid(data.band_id) : null,
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
