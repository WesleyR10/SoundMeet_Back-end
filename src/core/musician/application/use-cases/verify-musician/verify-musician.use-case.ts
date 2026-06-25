import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

export type VerifyMusicianInput = { id: string };
export type VerifyMusicianOutput = MusicianOutput;

export class VerifyMusicianUseCase
  implements IUseCase<VerifyMusicianInput, VerifyMusicianOutput>
{
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: VerifyMusicianInput): Promise<VerifyMusicianOutput> {
    const entity = await this.musicianRepo.findById(new MusicianId(input.id));

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    entity.verify();

    await this.musicianRepo.update(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}
