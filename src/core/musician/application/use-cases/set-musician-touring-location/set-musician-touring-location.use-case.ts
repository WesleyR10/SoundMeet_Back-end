import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IGeocodingService } from "../../../../shared/domain/geocoding.service";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Location } from "../../../../shared/domain/value-objects/location.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { MusicianOutputMapper } from "../common/musician-profile-output";
import { LocationInput } from "../update-musician-profile/update-musician-profile.input";
import { SetMusicianTouringLocationInput } from "./set-musician-touring-location.input";
import { SetMusicianTouringLocationOutput } from "./set-musician-touring-location.output";

export class SetMusicianTouringLocationUseCase implements IUseCase<
  SetMusicianTouringLocationInput,
  SetMusicianTouringLocationOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    // Diferente do update de perfil (best-effort, nunca bloqueia save): sem
    // coordenadas o modo turnê não tem função nenhuma, então geocodificação
    // que falha aqui BLOQUEIA — desvio intencional da regra geral (7.13d).
    private readonly geocodingService?: IGeocodingService,
  ) {}

  async execute(
    input: SetMusicianTouringLocationInput,
  ): Promise<SetMusicianTouringLocationOutput> {
    const musician = await this.musicianRepo.findById(new MusicianId(input.id));
    if (!musician) {
      throw new NotFoundError(input.id, Musician);
    }

    const profile = musician.ensureProfile();
    const location = await this.resolveLocation(input);
    const expiresAt = new Date(
      Date.now() + input.duration_days * 24 * 60 * 60 * 1000,
    );

    profile.setTouringLocation(location, expiresAt);
    if (profile.notification.hasErrors()) {
      throw new EntityValidationError(profile.notification.toJSON());
    }

    await this.musicianRepo.update(musician);

    return MusicianOutputMapper.toOutput(musician);
  }

  private async resolveLocation(input: LocationInput): Promise<Location> {
    const hasCoords =
      input.latitude !== null &&
      input.latitude !== undefined &&
      input.longitude !== null &&
      input.longitude !== undefined;

    if (hasCoords) {
      return new Location(input);
    }

    if (!this.geocodingService) {
      throw new EntityValidationError([
        {
          touring_location: [
            "Geocoding service unavailable — provide latitude/longitude explicitly",
          ],
        },
      ]);
    }

    const coords = await this.geocodingService.geocode({
      street: input.street,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      zip_code: input.zip_code,
    });

    if (!coords) {
      throw new EntityValidationError([
        {
          touring_location: [
            "Could not resolve coordinates for the provided address",
          ],
        },
      ]);
    }

    return new Location({
      ...input,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  }
}
