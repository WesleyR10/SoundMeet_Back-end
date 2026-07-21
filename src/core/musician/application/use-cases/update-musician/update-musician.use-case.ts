import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Musician } from "../../../domain/musician.aggregate";
import { MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";
import { UpdateMusicianInput } from "./update-musician.input";

export class UpdateMusicianUseCase implements IUseCase<
  UpdateMusicianInput,
  UpdateMusicianOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: UpdateMusicianInput): Promise<UpdateMusicianOutput> {
    const musicianId = new MusicianId(input.id);
    const entity = await this.musicianRepo.findById(musicianId);

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    if (input.email !== undefined && input.email !== entity.email.value) {
      const existing = await this.musicianRepo.findByEmail(input.email);
      if (existing && existing.musician_id.id !== entity.musician_id.id) {
        throw new EntityValidationError([
          { email: ["Email already in use by another musician"] },
        ]);
      }
      entity.changeEmail(input.email);
    }

    input.name !== undefined && entity.changeName(input.name);
    input.stage_name !== undefined && entity.changeStageName(input.stage_name);
    input.bio !== undefined && entity.changeBio(input.bio);
    input.avatar !== undefined && entity.changeAvatar(input.avatar);
    input.phone !== undefined && entity.changePhone(input.phone);
    input.genres !== undefined && entity.updateGenres(input.genres);
    input.instruments !== undefined &&
      entity.updateInstruments(input.instruments);
    input.experience_years !== undefined &&
      entity.updateExperience(input.experience_years);

    if (entity.profile) {
      input.genres !== undefined && entity.profile.updateGenres(input.genres);
      input.instruments !== undefined &&
        entity.profile.updateInstruments(input.instruments);
      input.experience_years !== undefined &&
        entity.profile.updateExperience(input.experience_years);
    }

    if (input.priceRanges !== undefined) {
      try {
        const priceRanges = (input.priceRanges ?? []).map(
          (props) => new PriceRange(props),
        );
        entity.updatePriceRanges(priceRanges);
      } catch (error: any) {
        entity.notification.addError(
          error?.message ?? "Invalid price range",
          "priceRanges",
        );
      }
    }

    if (input.is_active === true) {
      entity.activate();
    }
    if (input.is_active === false) {
      entity.deactivate();
    }

    input.open_to_gigs !== undefined &&
      entity.setOpenToGigs(input.open_to_gigs);

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.musicianRepo.update(entity);
    await this.domainEventMediator?.publish(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}

export type UpdateMusicianOutput = MusicianOutput;
