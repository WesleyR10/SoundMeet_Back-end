import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from "class-validator";
import { validateSync } from "class-validator";

export type SyncSyncedLyricsForMusicLibraryInputConstructorProps = {
  musician_id: string;
  music_library_id: string;
  force?: boolean;
};

export class SyncSyncedLyricsForMusicLibraryInput {
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsUUID()
  @IsNotEmpty()
  music_library_id: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;

  constructor(props: SyncSyncedLyricsForMusicLibraryInputConstructorProps) {
    this.musician_id = props.musician_id;
    this.music_library_id = props.music_library_id;
    this.force = props.force;
  }
}

export class ValidateSyncSyncedLyricsForMusicLibraryInput {
  static validate(input: SyncSyncedLyricsForMusicLibraryInput) {
    return validateSync(input);
  }
}
