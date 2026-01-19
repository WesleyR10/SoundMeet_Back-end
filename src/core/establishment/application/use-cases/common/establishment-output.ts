import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../../shared/domain/value-objects/price-range.vo";
import { Establishment } from "../../../domain/establishment.aggregate";
import { EstablishmentProfile } from "../../../domain/establishment-profile.aggregate";

export type EstablishmentProfileOutput = {
  id: string;
  establishment_id: string;
  capacity: number | null;
  location: Record<string, unknown>;
  amenities: string[];
  preferred_genres: string[];
  operating_hours: Record<string, unknown> | null;
  price_range: {
    model: PriceModel;
    min: number;
    max: number;
    currency: Currency;
    notes: string | null;
  } | null;
  social_links: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

export type EstablishmentOutput = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: {
    formatted: string | null;
    value: string | null;
  } | null;
  email: string;
  phone: string | null;
  website: string | null;
  establishment_type: string;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  profile: EstablishmentProfileOutput | null;
  created_at: Date;
  updated_at: Date;
  qr_code: string | null;
  is_highly_rated: boolean;
  is_popular: boolean;
  is_bar: boolean;
  is_restaurant: boolean;
  is_club: boolean;
};

export class EstablishmentOutputMapper {
  static toProfileOutput(
    profile: EstablishmentProfile,
  ): EstablishmentProfileOutput {
    return {
      id: profile.profile_id.id,
      establishment_id: profile.establishment_id.id,
      capacity: profile.capacity,
      location: profile.location.toJSON(),
      amenities: profile.amenities,
      preferred_genres: profile.preferredGenres,
      operating_hours: profile.operatingHours?.toJSON() ?? null,
      price_range: profile.priceRange
        ? {
            model: profile.priceRange.model,
            min: profile.priceRange.min,
            max: profile.priceRange.max,
            currency: profile.priceRange.currency,
            notes: profile.priceRange.notes,
          }
        : null,
      social_links: profile.socialLinks?.toJSON() ?? null,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  static toOutput(entity: Establishment): EstablishmentOutput {
    return {
      id: entity.establishment_id.id,
      name: entity.name,
      description: entity.description,
      avatar: entity.avatar,
      cnpj: entity.cnpj
        ? {
            formatted: entity.cnpj.formatted,
            value: entity.cnpj.value,
          }
        : null,
      email: entity.email.value,
      phone: entity.phone?.value ?? null,
      website: entity.website,
      establishment_type: entity.establishment_type,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      profile: entity.profile ? this.toProfileOutput(entity.profile) : null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      qr_code: entity.qr_code?.code ?? null,
      is_highly_rated: entity.isHighlyRated,
      is_popular: entity.isPopular,
      is_bar: entity.isBar,
      is_restaurant: entity.isRestaurant,
      is_club: entity.isClub,
    } as EstablishmentOutput;
  }
}
