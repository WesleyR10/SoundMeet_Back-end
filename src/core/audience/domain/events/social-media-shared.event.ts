import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export class SocialMediaSharedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 1;

  constructor(
    public aggregate_id: Uuid,
    public request_id: string,
    public platform: string,
    public message?: string,
  ) {
    this.occurred_on = new Date();
  }

  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      request_id: this.request_id,
      platform: this.platform,
      message: this.message,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }

  static fromJSON(data: any): SocialMediaSharedEvent {
    const event = new SocialMediaSharedEvent(
      new Uuid(data.aggregate_id),
      data.request_id,
      data.platform,
      data.message,
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
