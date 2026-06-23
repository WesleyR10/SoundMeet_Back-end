import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../../shared/domain/value-objects/price-range.vo";
import { Musician } from "../../../domain/musician.aggregate";

export type MusicianProfileOutput = {
  id: string;
  musician_id: string;
  price_range: {
    model: PriceModel;
    min: number;
    max: number;
    currency: Currency;
    notes: string | null;
  } | null;
  location: {
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  social_links: Record<string, unknown> | null;
  experience: number;
  instruments: string[];
  genres: string[];
  created_at: Date;
  updated_at: Date;
};

export type MusicianOutput = {
  id: string;
  name: string;
  email: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  phone: string | null;
  genres: string[];
  instruments: string[];
  experience_years: number;
  qr_code: string | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  profile: MusicianProfileOutput | null;
  created_at: Date;
  updated_at: Date;
  display_name: string;
  is_experienced: boolean;
  is_highly_rated: boolean;
};

export class MusicianOutputMapper {
  static toOutput(entity: Musician): MusicianOutput {
    return {
      id: entity.musician_id.id,
      name: entity.name,
      email: entity.email.value,
      stage_name: entity.stage_name,
      bio: entity.bio,
      avatar: entity.avatar,
      phone: entity.phone?.value ?? null,
      genres: entity.genres,
      instruments: entity.instruments,
      experience_years: entity.experience_years,
      qr_code: entity.qr_code?.code ?? null,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      profile: entity.profile
        ? {
            id: entity.profile.profile_id.id,
            musician_id: entity.profile.musician_id.id,
            price_range: entity.profile.priceRange
              ? {
                  model: entity.profile.priceRange.model,
                  min: entity.profile.priceRange.min,
                  max: entity.profile.priceRange.max,
                  currency: entity.profile.priceRange.currency,
                  notes: entity.profile.priceRange.notes,
                }
              : null,
            location: entity.profile.location.toJSON(),
            social_links: entity.profile.socialLinks,
            experience: entity.profile.experience,
            instruments: entity.profile.instruments,
            genres: entity.profile.genres,
            created_at: entity.profile.created_at,
            updated_at: entity.profile.updated_at,
          }
        : null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      display_name: entity.displayName,
      is_experienced: entity.isExperienced,
      is_highly_rated: entity.isHighlyRated,
    };
  }
}
