import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../domain/musician.aggregate";
import { MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";

export class DeleteMusicianUseCase
  implements IUseCase<DeleteMusicianInput, DeleteMusicianOutput>
{
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: DeleteMusicianInput): Promise<DeleteMusicianOutput> {
    const musicianId = new MusicianId(input.id);
    const entity = await this.musicianRepo.findById(musicianId);

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    await this.musicianRepo.delete(musicianId);
  }
}

export type DeleteMusicianInput = {
  id: string;
};

export type DeleteMusicianOutput = void;
