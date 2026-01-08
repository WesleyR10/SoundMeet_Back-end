import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Location } from "../../../../shared/domain/value-objects/location.vo";
import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import {
  PriceModel,
  PriceRange,
} from "../../../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import {
  MusicianProfile,
  MusicianProfileId,
} from "../../../domain/musician-profile.aggregate";
import {
  CurrencyDb,
  JsonValue,
  MusicianModel,
  MusicianProfileModel,
} from "./musician-model";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const toSocialLinks = (value: unknown): Record<string, unknown> | null => {
  return isRecord(value) ? value : null;
};

const toDbCurrency = (currency: Currency): CurrencyDb => {
  switch (currency) {
    case Currency.BRL:
      return "BRL";
    case Currency.USD:
      return "USD";
    case Currency.EUR:
      return "EUR";
  }
};

const toDomainCurrency = (currency: CurrencyDb): Currency => {
  switch (currency) {
    case "BRL":
      return Currency.BRL;
    case "USD":
      return Currency.USD;
    case "EUR":
      return Currency.EUR;
  }
};

export class MusicianModelMapper {
  static toModel(entity: Musician): Omit<MusicianModel, "profile"> {
    return {
      id: entity.musician_id.id,
      email: entity.email.value,
      name: entity.name,
      stage_name: entity.stage_name ?? null,
      bio: entity.bio ?? null,
      avatar: entity.avatar ?? null,
      phone: entity.phone?.value ?? null,
      genres: entity.genres ?? [],
      instruments: entity.instruments ?? [],
      experience_years: entity.experience_years ?? null,
      qr_code: entity.qr_code?.code ?? null,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toProfileModel(profile: MusicianProfile): MusicianProfileModel {
    return {
      id: profile.profile_id.id,
      musicianId: profile.musician_id.id,
      price_model: profile.priceRange?.model ?? null,
      price_min: profile.priceRange?.min ?? null,
      price_max: profile.priceRange?.max ?? null,
      price_currency: profile.priceRange
        ? toDbCurrency(profile.priceRange.currency)
        : null,
      price_notes: profile.priceRange?.notes ?? null,
      location: profile.location.toJSON() as unknown as JsonValue,
      socialLinks: (profile.socialLinks ?? null) as unknown as JsonValue | null,
      experience: profile.experience,
      instruments: profile.instruments,
      genres: profile.genres,
      rating: profile.rating.value,
      totalRatings: profile.total_ratings,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  static toEntity(model: MusicianModel): Musician {
    let profile: MusicianProfile | null = null;
    if (model.profile) {
      try {
        profile = new MusicianProfile({
          profile_id: new MusicianProfileId(model.profile.id),
          musician_id: new Uuid(model.profile.musicianId),
          priceRange:
            model.profile.price_model &&
            model.profile.price_min !== null &&
            model.profile.price_max !== null
              ? new PriceRange({
                  model: model.profile.price_model as PriceModel,
                  min: model.profile.price_min,
                  max: model.profile.price_max,
                  currency: model.profile.price_currency
                    ? toDomainCurrency(model.profile.price_currency)
                    : undefined,
                  notes: model.profile.price_notes,
                })
              : null,
          location: Location.fromJSON(model.profile.location),
          socialLinks: toSocialLinks(model.profile.socialLinks),
          experience: model.profile.experience,
          instruments: model.profile.instruments,
          genres: model.profile.genres,
          rating: model.profile.rating,
          total_ratings: model.profile.totalRatings,
          created_at: model.profile.created_at,
          updated_at: model.profile.updated_at,
        });
      } catch (error: any) {
        throw new LoadEntityError([
          {
            profile: [
              error?.message ??
                `Musician ${model.id} has invalid profile data in database`,
            ],
          },
        ]);
      }

      profile.validate();
      if (profile.notification.hasErrors()) {
        throw new LoadEntityError(profile.notification.toJSON());
      }
    }

    const musician = new Musician({
      musician_id: new MusicianId(model.id),
      email: model.email,
      name: model.name,
      stage_name: model.stage_name ?? undefined,
      bio: model.bio ?? undefined,
      avatar: model.avatar ?? undefined,
      phone: model.phone ?? undefined,
      genres: model.genres ?? [],
      instruments: model.instruments ?? [],
      experience_years: model.experience_years ?? undefined,
      qr_code: model.qr_code ?? undefined,
      rating: model.rating,
      total_ratings: model.total_ratings,
      is_active: model.is_active,
      is_verified: model.is_verified,
      created_at: model.created_at,
      updated_at: model.updated_at,
      profile: profile,
    });

    musician.validate();

    if (musician.notification.hasErrors()) {
      throw new LoadEntityError(musician.notification.toJSON());
    }

    return musician;
  }
}
