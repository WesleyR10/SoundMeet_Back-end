import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { AudienceId } from "../audience.aggregate";
import { Email, Phone } from "../../../shared/domain";

export type AudienceCreatedEventProps = {
  audience_id: AudienceId;
  name: string;
  email: Email;
  phone: Phone | null;
  avatar: string | null;
  favorite_genres: string[];
  totalPoints: number;
  currentLevel: number;
  badges: string[];
  is_active: boolean;
  created_at: Date;
};

export class AudienceCreatedEvent implements IDomainEvent {
  readonly aggregate_id: AudienceId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly name: string;
  readonly email: Email;
  readonly phone: Phone | null;
  readonly avatar: string | null;
  readonly favorite_genres: string[];
  readonly totalPoints: number;
  readonly currentLevel: number;
  readonly badges: string[];
  readonly is_active: boolean;
  readonly created_at: Date;

  constructor(props: AudienceCreatedEventProps) {
    this.aggregate_id = props.audience_id;
    this.name = props.name;
    this.email = props.email;
    this.phone = props.phone;
    this.avatar = props.avatar;
    this.favorite_genres = props.favorite_genres;
    this.totalPoints = props.totalPoints;
    this.currentLevel = props.currentLevel;
    this.badges = props.badges;
    this.is_active = props.is_active;
    this.created_at = props.created_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
