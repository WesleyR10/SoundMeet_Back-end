import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { AudienceId } from "../audience.aggregate";

export type AudienceBadgeEarnedEventProps = {
  audience_id: AudienceId;
  badge: string;
  earned_at: Date;
};

export class AudienceBadgeEarnedEvent implements IDomainEvent {
  readonly aggregate_id: AudienceId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly badge: string;
  readonly earned_at: Date;

  constructor(props: AudienceBadgeEarnedEventProps) {
    this.aggregate_id = props.audience_id;
    this.badge = props.badge;
    this.earned_at = props.earned_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
