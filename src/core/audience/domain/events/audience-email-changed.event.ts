import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { AudienceId } from "../audience.aggregate";

export class AudienceEmailChangedEvent implements IDomainEvent {
  readonly aggregate_id: AudienceId;
  readonly occurred_on: Date;
  readonly event_version: number;
  readonly audience_id: AudienceId;
  readonly new_email: string;
  readonly name: string;

  constructor(props: {
    audience_id: AudienceId;
    new_email: string;
    name: string;
  }) {
    this.aggregate_id = props.audience_id;
    this.audience_id = props.audience_id;
    this.new_email = props.new_email;
    this.name = props.name;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
