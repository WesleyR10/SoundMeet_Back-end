import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { MusicianOutputMapper } from "../common/musician-profile-output";
import { ClearMusicianTouringLocationInput } from "./clear-musician-touring-location.input";
import { ClearMusicianTouringLocationOutput } from "./clear-musician-touring-location.output";

export class ClearMusicianTouringLocationUseCase implements IUseCase<
  ClearMusicianTouringLocationInput,
  ClearMusicianTouringLocationOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(
    input: ClearMusicianTouringLocationInput,
  ): Promise<ClearMusicianTouringLocationOutput> {
    const musician = await this.musicianRepo.findById(new MusicianId(input.id));
    if (!musician) {
      throw new NotFoundError(input.id, Musician);
    }

    if (musician.profile) {
      musician.profile.clearTouringLocation();
      await this.musicianRepo.update(musician);
    }

    return MusicianOutputMapper.toOutput(musician);
  }
}
