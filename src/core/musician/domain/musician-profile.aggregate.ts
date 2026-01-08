import { AggregateRoot, Rating, Uuid } from "../../shared/domain";
import { Location } from "../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { MusicianProfileValidatorFactory } from "./musician-profile.validator";
import { MusicianProfileFakeBuilder } from "./musician-profile-fake.builder";

export type MusicianProfileSocialLinks = Record<string, unknown>;

export type MusicianProfileConstructorProps = {
  profile_id?: MusicianProfileId;
  musician_id: Uuid;
  priceRange?: PriceRange | null;
  location?: Location;
  socialLinks?: MusicianProfileSocialLinks | null;
  experience?: number;
  instruments?: string[];
  genres?: string[];
  rating?: number;
  total_ratings?: number;
  created_at?: Date;
  updated_at?: Date;
};

export type MusicianProfileCreateCommand = {
  profile_id?: MusicianProfileId;
  musician_id: Uuid;
  priceRange?: PriceRange | null;
  location?: Location;
  socialLinks?: MusicianProfileSocialLinks | null;
  experience?: number;
  instruments?: string[];
  genres?: string[];
};

export class MusicianProfileId extends Uuid {}

export class MusicianProfile extends AggregateRoot {
  profile_id: MusicianProfileId;
  musician_id: Uuid;
  priceRange: PriceRange | null;
  location: Location;
  socialLinks: MusicianProfileSocialLinks | null;
  experience: number;
  instruments: string[];
  genres: string[];
  rating: Rating;
  total_ratings: number;
  created_at: Date;
  updated_at: Date;

  constructor(props: MusicianProfileConstructorProps) {
    super();
    this.profile_id = props.profile_id ?? new MusicianProfileId();
    this.musician_id = props.musician_id;
    this.priceRange = props.priceRange ?? null;
    this.location = props.location ?? new Location({});
    this.socialLinks = props.socialLinks ?? null;
    this.experience = props.experience ?? 0;
    this.instruments = props.instruments ?? [];
    this.genres = props.genres ?? [];
    this.rating = new Rating(props.rating ?? 0);
    this.total_ratings = props.total_ratings ?? 0;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): Uuid {
    return this.profile_id;
  }

  static create(command: MusicianProfileCreateCommand): MusicianProfile {
    const profile = new MusicianProfile(command);
    profile.validate();
    return profile;
  }

  validate(fields?: string[]) {
    const validator = MusicianProfileValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  changePriceRange(priceRange: PriceRange | null) {
    this.priceRange = priceRange;
    this.updated_at = new Date();
  }

  changeLocation(location: Location) {
    this.location = location;
    this.updated_at = new Date();
  }

  changeSocialLinks(socialLinks: MusicianProfileSocialLinks | null) {
    this.socialLinks = socialLinks;
    this.updated_at = new Date();
  }

  updateExperience(years: number) {
    if (years < 0) {
      this.notification.addError("Experience cannot be negative", "experience");
      return;
    }
    this.experience = years;
    this.updated_at = new Date();
  }

  updateInstruments(instruments: string[]) {
    this.instruments = instruments;
    this.updated_at = new Date();
  }

  updateGenres(genres: string[]) {
    this.genres = genres;
    this.updated_at = new Date();
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
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      profile_id: this.profile_id.id,
      musician_id: this.musician_id.id,
      priceRange: this.priceRange?.toJSON() || null,
      location: this.location.toJSON(),
      socialLinks: this.socialLinks,
      experience: this.experience,
      instruments: this.instruments,
      genres: this.genres,
      rating: this.rating.value,
      total_ratings: this.total_ratings,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake() {
    return MusicianProfileFakeBuilder;
  }
}
