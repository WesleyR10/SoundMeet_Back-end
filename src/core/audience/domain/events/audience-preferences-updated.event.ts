import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { AudienceId } from "../audience.aggregate";

export type AudiencePreferencesUpdatedEventProps = {
  audience_id: AudienceId;
  favorite_genres: string[];
  favorite_artists: string[];
  favorite_instruments: string[];
  preferred_languages: string[];
  updated_at: Date;
};

export class AudiencePreferencesUpdatedEvent implements IDomainEvent {
  readonly aggregate_id: AudienceId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly favorite_genres: string[];
  readonly favorite_artists: string[];
  readonly favorite_instruments: string[];
  readonly preferred_languages: string[];
  readonly updated_at: Date;

  constructor(props: AudiencePreferencesUpdatedEventProps) {
    this.aggregate_id = props.audience_id;
    this.favorite_genres = props.favorite_genres;
    this.favorite_artists = props.favorite_artists;
    this.favorite_instruments = props.favorite_instruments;
    this.preferred_languages = props.preferred_languages;
    this.updated_at = props.updated_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
