import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../domain/music-library.aggregate";
import { IMusicLibraryRepository } from "../../../domain/music-library.repository";
import {
  MusicLibraryOutput,
  MusicLibraryOutputMapper,
} from "../common/music-library-output";
import { GetMusicLibraryInput } from "./get-music-library.input";

export class GetMusicLibraryUseCase implements IUseCase<
  GetMusicLibraryInput,
  GetMusicLibraryOutput
> {
  constructor(private readonly musicLibraryRepo: IMusicLibraryRepository) {}

  async execute(input: GetMusicLibraryInput): Promise<GetMusicLibraryOutput> {
    const musicLibraryId = new MusicLibraryId(input.id);
    const entity = await this.musicLibraryRepo.findById(musicLibraryId);

    if (!entity) {
      throw new NotFoundError(input.id, MusicLibrary);
    }

    return MusicLibraryOutputMapper.toOutput(entity);
  }
}

export type GetMusicLibraryOutput = MusicLibraryOutput;
