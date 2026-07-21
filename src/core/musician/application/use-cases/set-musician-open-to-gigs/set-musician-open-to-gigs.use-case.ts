import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";
import { SetMusicianOpenToGigsInput } from "./set-musician-open-to-gigs.input";

export type SetMusicianOpenToGigsOutput = MusicianOutput;

export class SetMusicianOpenToGigsUseCase implements IUseCase<
  SetMusicianOpenToGigsInput,
  SetMusicianOpenToGigsOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(
    input: SetMusicianOpenToGigsInput,
  ): Promise<SetMusicianOpenToGigsOutput> {
    const entity = await this.musicianRepo.findById(new MusicianId(input.id));

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    entity.setOpenToGigs(input.open_to_gigs);

    await this.musicianRepo.update(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}
