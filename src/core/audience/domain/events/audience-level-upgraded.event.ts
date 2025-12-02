import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { AudienceId } from "../audience.aggregate";

export type AudienceLevelUpgradedEventProps = {
  audience_id: AudienceId;
  new_level: number;
  new_level_name: string;
  total_points: number;
  occurred_at: Date;
};

export class AudienceLevelUpgradedEvent implements IDomainEvent {
  readonly aggregate_id: AudienceId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly new_level: number;
  readonly new_level_name: string;
  readonly total_points: number;

  constructor(props: AudienceLevelUpgradedEventProps) {
    this.aggregate_id = props.audience_id;
    this.new_level = props.new_level;
    this.new_level_name = props.new_level_name;
    this.total_points = props.total_points;
    this.occurred_on = props.occurred_at;
    this.event_version = 1;
  }
}
