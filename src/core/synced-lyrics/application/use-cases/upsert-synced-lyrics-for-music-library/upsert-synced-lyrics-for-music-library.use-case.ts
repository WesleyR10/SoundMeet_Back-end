import {
  ISyncedLyricsRepository,
  SyncedLyrics,
  SyncedLyricsId,
} from "@core/synced-lyrics/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  SyncedLyricsOutput,
  SyncedLyricsOutputMapper,
} from "../common/synced-lyrics-output";
import { UpsertSyncedLyricsForMusicLibraryInput } from "./upsert-synced-lyrics-for-music-library.input";

export class UpsertSyncedLyricsForMusicLibraryUseCase implements IUseCase<
  UpsertSyncedLyricsForMusicLibraryInput,
  SyncedLyricsOutput
> {
  constructor(private readonly repo: ISyncedLyricsRepository) {}

  async execute(
    input: UpsertSyncedLyricsForMusicLibraryInput,
  ): Promise<SyncedLyricsOutput> {
    const id = new SyncedLyricsId(input.music_library_id);
    const entity = await this.repo.findById(id);
    if (!entity || entity.musician_id.id !== input.musician_id) {
      throw new NotFoundError(input.music_library_id, SyncedLyrics);
    }

    entity.upsertFromRaw(
      {
        raw: input.raw,
        provider: input.provider,
        provider_meta: input.provider_meta ?? null,
        pipeline_version: input.pipeline_version,
      },
      new Date(),
    );

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.repo.update(entity);
    return SyncedLyricsOutputMapper.toOutput(entity);
  }
}
