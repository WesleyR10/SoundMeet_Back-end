import {
  AggregateRoot,
  Email,
  Phone,
  QRCode,
  Rating,
  Uuid,
} from "../../shared/domain";
import { Location } from "../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { MusicianCreatedEvent } from "./events/musician-created.event";
import { MusicianEmailChangedEvent } from "./events/musician-email-changed.event";
import { MusicianVerifiedEvent } from "./events/musician-verified.event";
import { MusicianValidatorFactory } from "./musician.validator";
import { MusicianFakeBuilder } from "./musician-fake.builder";
import { MusicianProfile } from "./musician-profile.aggregate";

export type MusicianConstructorProps = {
  musician_id?: MusicianId;
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
  profile?: MusicianProfile | null;
  created_at?: Date;
  updated_at?: Date;
};

export type MusicianCreateCommand = {
  musician_id?: MusicianId;
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
  profile?: MusicianProfile | null;
};

export class MusicianId extends Uuid {}

export class Musician extends AggregateRoot {
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
  profile: MusicianProfile | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: MusicianConstructorProps) {
    super();
    this.musician_id = props.musician_id ?? new MusicianId();
    const [email, errorEmail] = Email.create(props.email).asArray();
    this.email = email;
    errorEmail && this.notification.setError(errorEmail.message, "email");
    this.name = props.name;
    this.stage_name = props.stage_name ?? null;
    this.bio = props.bio ?? null;
    this.avatar = props.avatar ?? null;
    if (!props.phone) {
      this.phone = null;
    } else {
      const [phone, errorPhone] = Phone.create(props.phone).asArray();
      this.phone = phone;
      errorPhone && this.notification.setError(errorPhone.message, "phone");
    }
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years ?? 0;
    this.qr_code = props.qr_code
      ? new QRCode({
          code: props.qr_code,
          url: `https://soundmeet.app/musician/${this.musician_id.id}`,
        })
      : null;
    this.rating = new Rating(props.rating ?? 0);
    this.total_ratings = props.total_ratings ?? 0;
    this.is_active = props.is_active ?? true;
    this.is_verified = props.is_verified ?? false;
    this.profile = props.profile ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): MusicianId {
    return this.musician_id;
  }

  static create(props: MusicianCreateCommand): Musician {
    const musician = new Musician(props);
    musician.validate(["name", "email"]);
    musician.generateQRCode();
    musician.applyEvent(
      new MusicianCreatedEvent({
        musician_id: musician.musician_id,
        email: musician.email,
        name: musician.name,
        stage_name: musician.stage_name,
        bio: musician.bio,
        avatar: musician.avatar,
        phone: musician.phone,
        genres: musician.genres,
        instruments: musician.instruments,
        experience_years: musician.experience_years,
        qr_code: musician.qr_code,
        rating: musician.rating,
        total_ratings: musician.total_ratings,
        is_active: musician.is_active,
        is_verified: musician.is_verified,
        created_at: musician.created_at,
      }),
    );
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

  changeEmail(email: string): void {
    const emailOrError = Email.create(email);
    this.email = emailOrError.ok;
    emailOrError.isFail() &&
      this.notification.setError(emailOrError.error.message, "email");
    this.validate(["email"]);
    this.updated_at = new Date();
    if (!this.notification.hasErrors()) {
      this.applyEvent(
        new MusicianEmailChangedEvent({
          musician_id: this.musician_id,
          new_email: email,
          name: this.name,
        }),
      );
    }
  }

  changePhone(phone: string | null): void {
    if (!phone) {
      this.phone = null;
    } else {
      const [newPhone, errorPhone] = Phone.create(phone).asArray();
      this.phone = newPhone;
      errorPhone && this.notification.setError(errorPhone.message, "phone");
    }
  }

  updateGenres(genres: string[]): void {
    this.genres = genres;
    this.validate(["genres"]);
  }

  updateInstruments(instruments: string[]): void {
    this.instruments = instruments;
    this.validate(["instruments"]);
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

  updatePriceRange(price: PriceRange | null): void {
    this.ensureProfile().changePriceRange(price);
    this.updated_at = new Date();
  }

  ensureIsActive(): void {
    if (!this.is_active) {
      this.notification.addError("Musician is not active", "is_active");
    }
  }

  ensureProfile(): MusicianProfile {
    if (!this.profile) {
      this.profile = MusicianProfile.create({
        musician_id: this.musician_id,
        location: new Location({}),
        instruments: this.instruments,
        genres: this.genres,
        experience: this.experience_years,
      });
    }
    return this.profile;
  }

  generateQRCode(): void {
    const qrData = `soundmeet://musician/${this.musician_id.id}`;
    this.qr_code = new QRCode({
      code: qrData,
      url: `https://soundmeet.app/musician/${this.musician_id.id}`,
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
    this.applyEvent(
      new MusicianVerifiedEvent({
        musician_id: this.musician_id,
        verified_at: new Date(),
      }),
    );
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
    const sanitizedFields = fields?.length
      ? fields.filter(
          (field) =>
            !(
              (field === "email" && this.notification.errors.has("email")) ||
              (field === "phone" && this.notification.errors.has("phone"))
            ),
        )
      : fields;
    return validator.validate(this.notification, this, sanitizedFields);
  }

  static fake() {
    return MusicianFakeBuilder;
  }

  toJSON() {
    return {
      musician_id: this.musician_id.id,
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
      profile: this.profile?.toJSON() || null,
      created_at: this.created_at,
      updated_at: this.updated_at,
      display_name: this.displayName,
      is_experienced: this.isExperienced,
      is_highly_rated: this.isHighlyRated,
    };
  }
}
