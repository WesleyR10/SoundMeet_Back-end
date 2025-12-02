import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { AudienceId } from "../audience.aggregate";

export type AudienceUpdatedEventProps = {
  audience_id: AudienceId;
  name: string;
  email: string;
  nickname: string | null;
  avatar: string | null;
  phone: string | null;
  updated_at: Date;
};

export class AudienceUpdatedEvent implements IDomainEvent {
  readonly aggregate_id: AudienceId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly name: string;
  readonly email: string;
  readonly nickname: string | null;
  readonly avatar: string | null;
  readonly phone: string | null;
  readonly updated_at: Date;

  constructor(props: AudienceUpdatedEventProps) {
    this.aggregate_id = props.audience_id;
    this.name = props.name;
    this.email = props.email;
    this.nickname = props.nickname;
    this.avatar = props.avatar;
    this.phone = props.phone;
    this.updated_at = props.updated_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
