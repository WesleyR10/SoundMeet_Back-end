import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { MusicLibrary } from "../../../domain/music-library.aggregate";
import { IMusicLibraryRepository } from "../../../domain/music-library.repository";
import {
  MusicLibraryOutput,
  MusicLibraryOutputMapper,
} from "../common/music-library-output";
import { CreateMusicLibraryInput } from "./create-music-library.input";

export class CreateMusicLibraryUseCase implements IUseCase<
  CreateMusicLibraryInput,
  MusicLibraryOutput
> {
  constructor(private readonly musicLibraryRepo: IMusicLibraryRepository) {}

  async execute(input: CreateMusicLibraryInput): Promise<MusicLibraryOutput> {
    const entity = MusicLibrary.create({
      musician_id: input.musician_id,
      title: input.title,
      artist: input.artist,
      genre: input.genre,
      key: input.key,
      bpm: input.bpm,
      lyrics: input.lyrics,
      chords: input.chords,
      structure_segments: input.structure_segments,
      chord_sheet: input.chord_sheet,
      renderable_chord_sheet: input.renderable_chord_sheet,
      notes: input.notes,
      difficulty: input.difficulty,
      is_favorite: input.is_favorite,
      source: input.source,
      source_id: input.source_id,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.musicLibraryRepo.insert(entity);

    return MusicLibraryOutputMapper.toOutput(entity);
  }
}
