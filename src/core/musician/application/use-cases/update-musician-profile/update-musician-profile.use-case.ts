import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IGeocodingService } from "../../../../shared/domain/geocoding.service";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { MusicianOutputMapper } from "../common/musician-profile-output";
import { resolveLocation } from "../common/resolve-location";
import { UpdateMusicianProfileInput } from "./update-musician-profile.input";
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
      // Geocodificação best-effort (7.13c) — e a coordenada reenviada pelo app
      // é descartada quando o endereço mudou. Ver `resolveLocation`.
      profile.changeLocation(
        await resolveLocation(
          input.location,
          profile.location,
          this.geocodingService,
          "location",
        ),
      );
    }

    if (input.socialLinks !== undefined) {
      // Spread para objeto plano: `SocialLinksInput` é uma classe (precisa
      // ser, para o `@ValidateNested` do class-validator), e o agregado guarda
      // `Record<string, unknown>`.
      profile.changeSocialLinks(
        input.socialLinks ? { ...input.socialLinks } : null,
      );
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
