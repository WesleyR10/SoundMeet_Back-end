import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IGeocodingService } from "../../../../shared/domain/geocoding.service";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Location } from "../../../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { MusicianOutputMapper } from "../common/musician-profile-output";
import {
  LocationInput,
  UpdateMusicianProfileInput,
} from "./update-musician-profile.input";
import { UpdateMusicianProfileOutput } from "./update-musician-profile.output";

export class UpdateMusicianProfileUseCase implements IUseCase<
  UpdateMusicianProfileInput,
  UpdateMusicianProfileOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    // Opcional (mesmo padrão do PlanCheckService nos use-cases com gate):
    // sem o serviço, o comportamento é o anterior — salva sem coordenadas.
    private readonly geocodingService?: IGeocodingService,
  ) {}

  async execute(
    input: UpdateMusicianProfileInput,
  ): Promise<UpdateMusicianProfileOutput> {
    const musicianId = new MusicianId(input.id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.id, Musician);
    }

    const profile = musician.ensureProfile();

    if (input.priceRanges !== undefined) {
      try {
        const priceRanges = (input.priceRanges ?? []).map(
          (props) =>
            new PriceRange({
              model: props.model,
              min: props.min,
              max: props.max,
              currency: props.currency,
              notes: props.notes,
            }),
        );
        profile.changePriceRanges(priceRanges);
      } catch (error: any) {
        const notification = new Notification();
        notification.addError(
          error?.message ?? "Invalid price range",
          "priceRanges",
        );
        throw new EntityValidationError(notification.toJSON());
      }
    }

    if (input.location) {
      profile.changeLocation(await this.resolveLocation(input.location));
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

  // Geocodificação best-effort (7.13c): endereço salvo sem coordenadas
  // explícitas tenta CEP/endereço → coords para o músico entrar na busca por
  // raio. Falha do provedor nunca bloqueia o save — só fica sem coordenadas.
  private async resolveLocation(input: LocationInput): Promise<Location> {
    const hasCoords =
      input.latitude !== null &&
      input.latitude !== undefined &&
      input.longitude !== null &&
      input.longitude !== undefined;

    if (hasCoords || !this.geocodingService) {
      return new Location(input);
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
      return new Location(input);
    }

    return new Location({
      ...input,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  }
}
