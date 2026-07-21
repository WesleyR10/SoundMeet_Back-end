import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../../shared/domain/value-objects/price-range.vo";
import { QRCustomization } from "../../../../shared/domain/value-objects/qr-code.vo";
import { Musician } from "../../../domain/musician.aggregate";

export type MusicianProfileOutput = {
  id: string;
  musician_id: string;
  price_ranges: {
    model: PriceModel;
    min: number;
    max: number;
    currency: Currency;
    notes: string | null;
  }[];
  location: {
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    zip_code: string | null;
  };
  // Modo turnê (7.13d) — segundo ponto de busca, opcional e com expiração
  // automática; is_touring já considera a expiração (null/expirado = false).
  touring_location: MusicianProfileOutput["location"] | null;
  touring_expires_at: Date | null;
  is_touring: boolean;
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
  qr_customization: QRCustomization | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  open_to_gigs: boolean | null;
  profile: MusicianProfileOutput | null;
  created_at: Date;
  updated_at: Date;
  display_name: string;
  is_experienced: boolean;
  is_highly_rated: boolean;
  // Só populado por GetMusicianUseCase (injeta PlanCheckService) — demais
  // use-cases que reaproveitam este mapper (create/update/upload-avatar/etc.)
  // deixam undefined; o mobile sempre revalida via GET após qualquer mutation,
  // então nunca lê plan_tier do corpo de uma resposta de PATCH/POST.
  plan_tier?: string;
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
      qr_customization: entity.qr_code?.customization ?? null,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      open_to_gigs: entity.open_to_gigs,
      profile: entity.profile
        ? {
            id: entity.profile.profile_id.id,
            musician_id: entity.profile.musician_id.id,
            price_ranges: entity.profile.priceRanges.map((range) => ({
              model: range.model,
              min: range.min,
              max: range.max,
              currency: range.currency,
              notes: range.notes,
            })),
            location: entity.profile.location.toJSON(),
            touring_location: entity.profile.touring_location?.toJSON() ?? null,
            touring_expires_at: entity.profile.touring_expires_at,
            is_touring: entity.profile.isTouring,
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
