import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../domain/musician.aggregate";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-output";
import { UpdateMusicianInput } from "./update-musician.input";

export class UpdateMusicianUseCase
  implements IUseCase<UpdateMusicianInput, UpdateMusicianOutput>
{
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: UpdateMusicianInput): Promise<UpdateMusicianOutput> {
    const musicianId = new MusicianId(input.id);
    const entity = await this.musicianRepo.findById(musicianId);

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
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

    if (input.is_active === true) {
      entity.activate();
    }
    if (input.is_active === false) {
      entity.deactivate();
    }

    if (input.is_verified === true) {
      entity.verify();
    }
    if (input.is_verified === false) {
      entity.unverify();
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.musicianRepo.update(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}

export type UpdateMusicianOutput = MusicianOutput;
