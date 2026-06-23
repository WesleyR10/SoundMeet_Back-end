import { OmitType } from "@nestjs/swagger";

import { UpsertSyncedLyricsForMusicLibraryInput } from "../../../core/synced-lyrics/application/use-cases";

export class UpsertSyncedLyricsForMusicLibraryInputWithoutIds extends OmitType(
  UpsertSyncedLyricsForMusicLibraryInput,
  ["musician_id", "music_library_id"] as const,
) {}

export class UpsertSyncedLyricsDto extends UpsertSyncedLyricsForMusicLibraryInputWithoutIds {}
