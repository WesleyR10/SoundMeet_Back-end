import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Musician } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-output";
import { CreateMusicianInput } from "./create-musician.input";

export class CreateMusicianUseCase implements IUseCase<
  CreateMusicianInput,
  MusicianOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: CreateMusicianInput): Promise<MusicianOutput> {
    const entity = Musician.create({
      email: input.email,
      name: input.name,
      stage_name: input.stage_name,
      bio: input.bio,
      avatar: input.avatar,
      phone: input.phone,
      genres: input.genres || [],
      instruments: input.instruments || [],
      experience_years: input.experience_years,
      is_active: input.is_active,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.musicianRepo.insert(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}
