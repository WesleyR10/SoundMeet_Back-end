import { ValueObject } from "../../shared/domain/value-object";
import { MusicianValidatorFactory } from "./musician.validator";
import { MusicianFakeBuilder } from "./musician-fake.builder";
import {
  AggregateRoot,
  Uuid,
  Email,
  Phone,
  QRCode,
  Rating,
} from "../../shared/domain";

export type MusicianConstructorProps = {
  id?: MusicianId;
  email: string;
  name: string;
  stage_name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  phone?: string | null;
  genres: string[];
  instruments: string[];
  experience_years?: number;
  qr_code?: string | null;
  rating?: number;
  total_ratings?: number;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: Date;
};

export type MusicianCreateCommand = {
  email: string;
  name: string;
  stage_name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  phone?: string | null;
  genres: string[];
  instruments: string[];
  experience_years?: number;
  is_active?: boolean;
};

export class MusicianId extends Uuid {}

export class Musician extends AggregateRoot {
  id: MusicianId;
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

  constructor(props: MusicianConstructorProps) {
    super();
    this.id = props.id ?? new MusicianId();
    this.email = new Email(props.email);
    this.name = props.name;
    this.stage_name = props.stage_name ?? null;
    this.bio = props.bio ?? null;
    this.avatar = props.avatar ?? null;
    this.phone = props.phone ? new Phone(props.phone) : null;
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years ?? 0;
    this.qr_code = props.qr_code
      ? new QRCode({
          code: props.qr_code,
          url: `https://soundmeet.app/musician/${this.id.id}`,
        })
      : null;
    this.rating = new Rating(props.rating ?? 0);
    this.total_ratings = props.total_ratings ?? 0;
    this.is_active = props.is_active ?? true;
    this.is_verified = props.is_verified ?? false;
    this.created_at = props.created_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(props: MusicianCreateCommand): Musician {
    const musician = new Musician(props);
    musician.validate(["name", "email"]);
    musician.generateQRCode();
    return musician;
  }

  changeName(name: string): void {
    this.name = name;
    this.validate(["name"]);
  }

  changeStageName(stage_name: string | null): void {
    this.stage_name = stage_name;
  }

  changeBio(bio: string | null): void {
    this.bio = bio;
  }

  changeAvatar(avatar: string | null): void {
    this.avatar = avatar;
  }

  changePhone(phone: string | null): void {
    this.phone = phone ? new Phone(phone) : null;
  }

  updateGenres(genres: string[]): void {
    this.genres = genres;
    this.validate(["genres"]);
  }

  updateInstruments(instruments: string[]): void {
    this.instruments = instruments;
    this.validate();
  }

  updateExperience(years: number): void {
    if (years < 0) {
      this.notification.addError(
        "Experience years cannot be negative",
        "experience_years",
      );
      return;
    }
    this.experience_years = years;
  }

  generateQRCode(): void {
    const qrData = `soundmeet://musician/${this.id.id}`;
    this.qr_code = new QRCode({
      code: qrData,
      url: `https://soundmeet.app/musician/${this.id.id}`,
    });
  }

  addRating(rating: number): void {
    if (rating < 1 || rating > 5) {
      this.notification.addError("Rating must be between 1 and 5", "rating");
      return;
    }

    const totalScore = this.rating.value * this.total_ratings + rating;
    this.total_ratings += 1;
    const newAverage = totalScore / this.total_ratings;
    this.rating = new Rating(Math.round(newAverage * 10) / 10);
  }

  activate(): void {
    this.is_active = true;
  }

  deactivate(): void {
    this.is_active = false;
  }

  verify(): void {
    this.is_verified = true;
  }

  unverify(): void {
    this.is_verified = false;
  }

  get displayName(): string {
    return this.stage_name || this.name;
  }

  get isExperienced(): boolean {
    return this.experience_years >= 5;
  }

  get isHighlyRated(): boolean {
    return this.rating.isGood && this.total_ratings >= 10;
  }

  validate(fields?: string[]) {
    const validator = MusicianValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return MusicianFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      email: this.email.value,
      name: this.name,
      stage_name: this.stage_name,
      bio: this.bio,
      avatar: this.avatar,
      phone: this.phone?.value || null,
      genres: this.genres,
      instruments: this.instruments,
      experience_years: this.experience_years,
      qr_code: this.qr_code?.code || null,
      rating: this.rating.value,
      total_ratings: this.total_ratings,
      is_active: this.is_active,
      is_verified: this.is_verified,
      created_at: this.created_at,
      display_name: this.displayName,
      is_experienced: this.isExperienced,
      is_highly_rated: this.isHighlyRated,
    };
  }
}
