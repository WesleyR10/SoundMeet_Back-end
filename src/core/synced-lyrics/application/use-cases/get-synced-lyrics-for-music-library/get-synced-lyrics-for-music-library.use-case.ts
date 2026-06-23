import {
  ISyncedLyricsRepository,
  SyncedLyrics,
  SyncedLyricsId,
} from "@core/synced-lyrics/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  SyncedLyricsOutput,
  SyncedLyricsOutputMapper,
} from "../common/synced-lyrics-output";

export type GetSyncedLyricsForMusicLibraryInput = {
  musician_id: string;
  music_library_id: string;
  include_raw?: boolean;
};

export class GetSyncedLyricsForMusicLibraryUseCase implements IUseCase<
  GetSyncedLyricsForMusicLibraryInput,
  SyncedLyricsOutput
> {
  constructor(private readonly repo: ISyncedLyricsRepository) {}

  async execute(
    input: GetSyncedLyricsForMusicLibraryInput,
  ): Promise<SyncedLyricsOutput> {
    const id = new SyncedLyricsId(input.music_library_id);
    const entity = await this.repo.findById(id);
    if (!entity || entity.musician_id.id !== input.musician_id) {
      throw new NotFoundError(input.music_library_id, SyncedLyrics);
    }
    return SyncedLyricsOutputMapper.toOutput(entity, {
      include_raw: input.include_raw === true,
    });
  }
}
