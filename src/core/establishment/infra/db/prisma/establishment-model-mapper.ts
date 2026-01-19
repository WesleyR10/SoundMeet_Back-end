import {
  Address,
  OperatingHours,
  SocialLinks,
  Uuid,
} from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Email } from "../../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../../shared/domain/value-objects/phone.vo";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Rating } from "../../../../shared/domain/value-objects/rating.vo";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import {
  EstablishmentProfile,
  EstablishmentProfileId,
} from "../../../domain/establishment-profile.aggregate";
import {
  EstablishmentModel,
  EstablishmentProfileModel,
  JsonValue,
} from "./establishment-model";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const toSocialLinks = (value: unknown): SocialLinks | null => {
  if (!isRecord(value)) {
    return null;
  }
  const links = (value as any).links;
  if (!Array.isArray(links)) {
    return null;
  }
  return SocialLinks.create(links);
};

export type EstablishmentModelProps = EstablishmentModel;

export class EstablishmentModelMapper {
  static toModel(entity: Establishment): Omit<EstablishmentModel, "profile"> {
    return {
      id: entity.establishment_id.id,
      email: entity.email.value,
      name: entity.name,
      description: entity.description,
      avatar: entity.avatar,
      phone: entity.phone?.value ?? null,
      cnpj: entity.cnpj?.value ?? null,
      website: entity.website,
      establishment_type: entity.establishment_type,
      qr_code: entity.qr_code?.code ?? null,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toProfileModel(
    profile: EstablishmentProfile,
  ): EstablishmentProfileModel {
    return {
      id: profile.profile_id.id,
      establishmentId: profile.establishment_id.id,
      capacity: profile.capacity,
      location: profile.location.toJSON() as unknown as JsonValue,
      location_city: profile.location.city,
      location_lat: profile.location.latitude ?? null,
      location_lng: profile.location.longitude ?? null,
      amenities: profile.amenities,
      preferredGenres: profile.preferredGenres,
      operatingHours: (profile.operatingHours?.toJSON() ??
        null) as unknown as JsonValue | null,
      priceRange: (profile.priceRange?.toJSON() ??
        null) as unknown as JsonValue | null,
      socialLinks: (profile.socialLinks
        ? ({ links: profile.socialLinks.links } as any)
        : null) as unknown as JsonValue | null,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  static toEntity(model: EstablishmentModel): Establishment {
    let profile: EstablishmentProfile | null = null;
    if (model.profile) {
      try {
        if (!isRecord(model.profile.location)) {
          throw new Error("Invalid establishment profile location");
        }

        const locationJson: any = model.profile.location;
        const address = new Address({
          street: locationJson.street,
          number: locationJson.number,
          complement: locationJson.complement,
          neighborhood: locationJson.neighborhood,
          city: locationJson.city,
          state: locationJson.state,
          zipCode: locationJson.zipCode ?? locationJson.zip_code,
          country: locationJson.country,
          latitude: locationJson.latitude,
          longitude: locationJson.longitude,
        });

        const operatingHours = isRecord(model.profile.operatingHours)
          ? OperatingHours.fromJSON(model.profile.operatingHours)
          : null;

        const priceRange = isRecord(model.profile.priceRange)
          ? PriceRange.fromJSON(model.profile.priceRange)
          : null;

        const socialLinks = toSocialLinks(model.profile.socialLinks);

        profile = new EstablishmentProfile({
          profile_id: new EstablishmentProfileId(model.profile.id),
          establishment_id: new Uuid(model.profile.establishmentId),
          capacity: model.profile.capacity,
          location: address,
          amenities: model.profile.amenities ?? [],
          preferredGenres: model.profile.preferredGenres ?? [],
          operatingHours,
          priceRange,
          socialLinks,
          created_at: model.profile.created_at,
          updated_at: model.profile.updated_at,
        });
      } catch (error: any) {
        throw new LoadEntityError([
          {
            profile: [
              error?.message ??
                `Establishment ${model.id} has invalid profile data in database`,
            ],
          },
        ]);
      }

      profile.validate();
      if (profile.notification.hasErrors()) {
        throw new LoadEntityError(profile.notification.toJSON());
      }
    }

    const entity = new Establishment({
      establishment_id: new EstablishmentId(model.id),
      name: model.name,
      email: new Email(model.email),
      cnpj: model.cnpj, // Passamos a string direta, o construtor converte para VO
      description: model.description,
      avatar: model.avatar,
      phone: model.phone ? new Phone(model.phone) : null,
      website: model.website,
      establishment_type: model.establishment_type,
      rating: new Rating(model.rating),
      total_ratings: model.total_ratings,
      qr_code: model.qr_code,
      is_active: model.is_active,
      is_verified: model.is_verified,
      profile,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
