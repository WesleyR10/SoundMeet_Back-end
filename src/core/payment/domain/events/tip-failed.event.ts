import { IDomainEvent, Uuid } from "../../../shared/domain";

export class TipFailedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 1;
  constructor(
    public aggregate_id: Uuid,
    public musician_id: Uuid | null,
    public audience_id: Uuid,
    public reason: string | null = null,
    public band_id: Uuid | null = null,
  ) {
    this.occurred_on = new Date();
  }
  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      musician_id: this.musician_id?.id || null,
      audience_id: this.audience_id.id,
      reason: this.reason,
      band_id: this.band_id?.id || null,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }
  static fromJSON(data: any): TipFailedEvent {
    const event = new TipFailedEvent(
      new Uuid(data.aggregate_id),
      data.musician_id ? new Uuid(data.musician_id) : null,
      new Uuid(data.audience_id),
      data.reason ?? null,
      data.band_id ? new Uuid(data.band_id) : null,
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
