import { Email, Phone, QRCode, Rating } from "../../../shared/domain";
import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { MusicianId } from "../musician.aggregate";

export type MusicianCreatedEventProps = {
  musician_id: MusicianId;
  email: Email;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  phone: Phone | null;
  genres: string[];
  instruments: string[];
  experience_years: number;
  qr_code: QRCode | null;
  rating: Rating;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
};

export class MusicianCreatedEvent implements IDomainEvent {
  readonly aggregate_id: MusicianId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly email: Email;
  readonly name: string;
  readonly stage_name: string | null;
  readonly bio: string | null;
  readonly avatar: string | null;
  readonly phone: Phone | null;
  readonly genres: string[];
  readonly instruments: string[];
  readonly experience_years: number;
  readonly qr_code: QRCode | null;
  readonly rating: Rating;
  readonly total_ratings: number;
  readonly is_active: boolean;
  readonly is_verified: boolean;
  readonly created_at: Date;

  constructor(props: MusicianCreatedEventProps) {
    this.aggregate_id = props.musician_id;
    this.email = props.email;
    this.name = props.name;
    this.stage_name = props.stage_name;
    this.bio = props.bio;
    this.avatar = props.avatar;
    this.phone = props.phone;
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years;
    this.qr_code = props.qr_code;
    this.rating = props.rating;
    this.total_ratings = props.total_ratings;
    this.is_active = props.is_active;
    this.is_verified = props.is_verified;
    this.created_at = props.created_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
