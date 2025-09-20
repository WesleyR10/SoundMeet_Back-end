import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-output";

export class GetMusicianUseCase
  implements IUseCase<GetMusicianInput, GetMusicianOutput>
{
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: GetMusicianInput): Promise<GetMusicianOutput> {
    const musicianId = new MusicianId(input.id);
    const entity = await this.musicianRepo.findById(musicianId);

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    return MusicianOutputMapper.toOutput(entity);
  }
}

export type GetMusicianInput = {
  id: string;
};

export type GetMusicianOutput = MusicianOutput;
