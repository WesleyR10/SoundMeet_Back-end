import { OperatingHours } from "@core/shared/domain/value-objects/operating-hours.vo";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IGeocodingService } from "../../../../shared/domain/geocoding.service";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Address } from "../../../../shared/domain/value-objects/address.vo";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { SocialLinks } from "../../../../shared/domain/value-objects/social-links.vo";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import { EstablishmentOutputMapper } from "../common/establishment-output";
import { UpdateEstablishmentProfileInput } from "./update-establishment-profile.input";
import { UpdateEstablishmentProfileOutput } from "./update-establishment-profile.output";

export class UpdateEstablishmentProfileUseCase implements IUseCase<
  UpdateEstablishmentProfileInput,
  UpdateEstablishmentProfileOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    // Opcional (mesmo padrão do UpdateMusicianProfileUseCase): sem o
    // serviço, o comportamento é o anterior — salva sem coordenadas.
    private readonly geocodingService?: IGeocodingService,
  ) {}

  async execute(
    input: UpdateEstablishmentProfileInput,
  ): Promise<UpdateEstablishmentProfileOutput> {
    const establishmentId = new EstablishmentId(input.id);
    const establishment =
      await this.establishmentRepo.findById(establishmentId);

    if (!establishment) {
      throw new NotFoundError(input.id, Establishment);
    }

    if (!establishment.profile && !input.location) {
      const notification = new Notification();
      notification.addError("Location is required", "location");
      throw new EntityValidationError(notification.toJSON());
    }

    // Geocodificação best-effort (7.13c) resolvida uma única vez — o mesmo
    // endereço serve pro ensureProfile e pro changeLocation abaixo.
    const location = input.location
      ? await this.resolveLocation(input.location)
      : null;

    const profile = establishment.profile
      ? establishment.profile
      : establishment.ensureProfile(this.toAddress(location!));

    if (input.capacity !== undefined) {
      profile.changeCapacity(input.capacity);
    }

    if (location) {
      profile.changeLocation(this.toAddress(location));
    }

    if (input.amenities) {
      profile.updateAmenities(input.amenities);
    }

    if (input.preferredGenres) {
      profile.updatePreferredGenres(input.preferredGenres);
    }

    if (input.operatingHours !== undefined) {
      if (input.operatingHours === null) {
        profile.changeOperatingHours(null);
      } else {
        try {
          profile.changeOperatingHours(
            OperatingHours.fromJSON(input.operatingHours),
          );
        } catch (error: any) {
          const notification = new Notification();
          notification.addError(
            error?.message ?? "Invalid operating hours",
            "operatingHours",
          );
          throw new EntityValidationError(notification.toJSON());
        }
      }
    }

    if (input.priceRange !== undefined) {
      if (input.priceRange === null) {
        profile.changePriceRange(null);
      } else {
        try {
          profile.changePriceRange(
            new PriceRange({
              model: input.priceRange.model,
              min: input.priceRange.min,
              max: input.priceRange.max,
              currency: input.priceRange.currency,
              notes: input.priceRange.notes,
            }),
          );
        } catch (error: any) {
          const notification = new Notification();
          notification.addError(
            error?.message ?? "Invalid price range",
            "priceRange",
          );
          throw new EntityValidationError(notification.toJSON());
        }
      }
    }

    if (input.socialLinks !== undefined) {
      if (input.socialLinks === null) {
        profile.changeSocialLinks(null);
      } else {
        try {
          profile.changeSocialLinks(
            SocialLinks.create(
              Array.isArray(input.socialLinks.links)
                ? input.socialLinks.links
                : [],
            ),
          );
        } catch (error: any) {
          const notification = new Notification();
          notification.addError(
            error?.message ?? "Invalid social links",
            "socialLinks",
          );
          throw new EntityValidationError(notification.toJSON());
        }
      }
    }

    const notification = new Notification();
    notification.copyErrors(establishment.notification);
    notification.copyErrors(profile.notification);
    if (notification.hasErrors()) {
      throw new EntityValidationError(notification.toJSON());
    }

    await this.establishmentRepo.update(establishment);

    return EstablishmentOutputMapper.toProfileOutput(profile);
  }

  private async resolveLocation(
    location: NonNullable<UpdateEstablishmentProfileInput["location"]>,
  ): Promise<NonNullable<UpdateEstablishmentProfileInput["location"]>> {
    const hasCoords =
      location.latitude !== null &&
      location.latitude !== undefined &&
      location.longitude !== null &&
      location.longitude !== undefined;

    if (hasCoords || !this.geocodingService) {
      return location;
    }

    const coords = await this.geocodingService.geocode({
      street: location.street,
      number: location.number,
      neighborhood: location.neighborhood,
      city: location.city,
      state: location.state,
      zip_code: location.zipCode,
    });

    if (!coords) {
      return location;
    }

    return {
      ...location,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  }

  private toAddress(input: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }): Address {
    try {
      return new Address({
        street: input.street,
        number: input.number,
        complement: input.complement,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        country: input.country,
        latitude: input.latitude,
        longitude: input.longitude,
      });
    } catch (error: any) {
      const notification = new Notification();
      notification.addError(error?.message ?? "Invalid location", "location");
      throw new EntityValidationError(notification.toJSON());
    }
  }
}
