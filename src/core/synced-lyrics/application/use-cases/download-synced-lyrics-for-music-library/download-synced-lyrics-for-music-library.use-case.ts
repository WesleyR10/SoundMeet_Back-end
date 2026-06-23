import {
  ISyncedLyricsRepository,
  SyncedLyrics,
  SyncedLyricsId,
} from "@core/synced-lyrics/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  DownloadSyncedLyricsForMusicLibraryInput,
  DownloadSyncedLyricsForMusicLibraryInputConstructorProps,
  ValidateDownloadSyncedLyricsForMusicLibraryInput,
} from "./download-synced-lyrics-for-music-library.input";

export type DownloadSyncedLyricsForMusicLibraryOutput = {
  filename: string;
  content_type: string;
  body: string;
};

export class DownloadSyncedLyricsForMusicLibraryUseCase implements IUseCase<
  DownloadSyncedLyricsForMusicLibraryInput,
  DownloadSyncedLyricsForMusicLibraryOutput
> {
  constructor(private readonly repo: ISyncedLyricsRepository) {}

  async execute(
    input:
      | DownloadSyncedLyricsForMusicLibraryInput
      | DownloadSyncedLyricsForMusicLibraryInputConstructorProps,
  ): Promise<DownloadSyncedLyricsForMusicLibraryOutput> {
    const validatedInput =
      input instanceof DownloadSyncedLyricsForMusicLibraryInput
        ? input
        : new DownloadSyncedLyricsForMusicLibraryInput(input);

    const errors =
      ValidateDownloadSyncedLyricsForMusicLibraryInput.validate(validatedInput);
    if (errors.length) {
      const notification = new Notification();
      for (const error of errors as any[]) {
        const field = String(error?.property ?? "");
        const constraints = error?.constraints;
        if (constraints && typeof constraints === "object") {
          for (const message of Object.values(constraints)) {
            notification.addError(String(message), field || undefined);
          }
          continue;
        }
        notification.addError("Validation failed", field || undefined);
      }
      throw new EntityValidationError(notification.toJSON());
    }

    const id = new SyncedLyricsId(validatedInput.music_library_id);
    const entity = await this.repo.findById(id);
    if (!entity || entity.musician_id.id !== validatedInput.musician_id) {
      throw new NotFoundError(validatedInput.music_library_id, SyncedLyrics);
    }
    if (!entity.lrc_raw) {
      throw new NotFoundError(validatedInput.music_library_id, SyncedLyrics);
    }

    const filename =
      validatedInput.filename?.trim() ||
      this.defaultFilename(entity.artist, entity.title);

    return {
      filename,
      content_type: "text/plain; charset=utf-8",
      body: entity.lrc_raw,
    };
  }

  private defaultFilename(artist: string, title: string): string {
    const raw = `${artist} - ${title}.lrc`;
    const normalized = raw
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .replace(/[^\p{L}\p{N} ._-]+/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    return normalized.length ? normalized : "lyrics.lrc";
  }
}
