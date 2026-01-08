import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Location } from "../../../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { MusicianOutputMapper } from "../common/musician-profile-output";
import { UpdateMusicianProfileInput } from "./update-musician-profile.input";
import { UpdateMusicianProfileOutput } from "./update-musician-profile.output";

export class UpdateMusicianProfileUseCase implements IUseCase<
  UpdateMusicianProfileInput,
  UpdateMusicianProfileOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(
    input: UpdateMusicianProfileInput,
  ): Promise<UpdateMusicianProfileOutput> {
    const musicianId = new MusicianId(input.id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.id, Musician);
    }

    const profile = musician.ensureProfile();

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

    if (input.location) {
      profile.changeLocation(new Location(input.location));
    }

    if (input.experience !== undefined) {
      profile.updateExperience(input.experience);
    }

    if (input.instruments) {
      profile.updateInstruments(input.instruments);
      musician.updateInstruments(input.instruments);
    }

    if (input.genres) {
      profile.updateGenres(input.genres);
      musician.updateGenres(input.genres);
    }

    if (input.socialLinks !== undefined) {
      profile.changeSocialLinks(input.socialLinks);
    }

    const notification = new Notification();
    notification.copyErrors(musician.notification);
    notification.copyErrors(profile.notification);
    if (notification.hasErrors()) {
      throw new EntityValidationError(notification.toJSON());
    }

    await this.musicianRepo.update(musician);

    return MusicianOutputMapper.toOutput(musician);
  }
}
