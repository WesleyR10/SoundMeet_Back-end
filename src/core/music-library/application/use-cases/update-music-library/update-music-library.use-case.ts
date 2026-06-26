import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../domain/music-library.aggregate";
import { IMusicLibraryRepository } from "../../../domain/music-library.repository";
import {
  MusicLibraryOutput,
  MusicLibraryOutputMapper,
} from "../common/music-library-output";
import { UpdateMusicLibraryInput } from "./update-music-library.input";

export class UpdateMusicLibraryUseCase implements IUseCase<
  UpdateMusicLibraryInput,
  UpdateMusicLibraryOutput
> {
  constructor(private readonly musicLibraryRepo: IMusicLibraryRepository) {}

  async execute(
    input: UpdateMusicLibraryInput,
  ): Promise<UpdateMusicLibraryOutput> {
    const musicLibraryId = new MusicLibraryId(input.id);
    const entity = await this.musicLibraryRepo.findById(musicLibraryId);

    if (!entity) {
      throw new NotFoundError(input.id, MusicLibrary);
    }

    if (!input.is_admin) {
      if (
        !input.requesting_musician_id ||
        entity.musician_id.id !== input.requesting_musician_id
      ) {
        throw new ForbiddenException(
          "Você não tem permissão para editar este item da biblioteca.",
        );
      }
    }

    input.title !== undefined && entity.changeTitle(input.title);
    input.artist !== undefined && entity.changeArtist(input.artist);
    input.genre !== undefined && entity.changeGenre(input.genre);
    input.key !== undefined && entity.changeKey(input.key);
    input.bpm !== undefined && entity.changeBpm(input.bpm);
    input.lyrics !== undefined && entity.changeLyrics(input.lyrics);
    input.notes !== undefined && entity.changeNotes(input.notes);
    input.difficulty !== undefined && entity.changeDifficulty(input.difficulty);
    input.chords !== undefined && entity.updateChords(input.chords);
    input.structure_segments !== undefined &&
      entity.updateStructureSegments(input.structure_segments);
    input.chord_sheet !== undefined &&
      entity.updateChordSheet(input.chord_sheet);
    input.renderable_chord_sheet !== undefined &&
      entity.updateRenderableChordSheet(input.renderable_chord_sheet);

    if (input.source !== undefined) {
      entity.changeSource(input.source, input.source_id);
    } else if (input.source_id !== undefined) {
      entity.changeSource(entity.source, input.source_id);
    }

    if (input.is_favorite === true) {
      entity.markFavorite();
    }
    if (input.is_favorite === false) {
      entity.unmarkFavorite();
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.musicLibraryRepo.update(entity);

    return MusicLibraryOutputMapper.toOutput(entity);
  }
}

export type UpdateMusicLibraryOutput = MusicLibraryOutput;
