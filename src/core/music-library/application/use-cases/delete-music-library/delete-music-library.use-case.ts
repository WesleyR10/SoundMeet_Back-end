import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../domain/music-library.aggregate";
import { IMusicLibraryRepository } from "../../../domain/music-library.repository";
import { DeleteMusicLibraryInput } from "./delete-music-library.input";

export class DeleteMusicLibraryUseCase implements IUseCase<
  DeleteMusicLibraryInput,
  DeleteMusicLibraryOutput
> {
  constructor(private readonly musicLibraryRepo: IMusicLibraryRepository) {}

  async execute(
    input: DeleteMusicLibraryInput,
  ): Promise<DeleteMusicLibraryOutput> {
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
          "Você não tem permissão para remover este item da biblioteca.",
        );
      }
    }

    await this.musicLibraryRepo.delete(musicLibraryId);
  }
}

export type DeleteMusicLibraryOutput = void;
