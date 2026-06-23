import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsUUID } from "class-validator";
import { validateSync } from "class-validator";

export type DownloadSyncedLyricsForMusicLibraryInputConstructorProps = {
  musician_id: string;
  music_library_id: string;
  filename?: string;
};

export class DownloadSyncedLyricsForMusicLibraryInput {
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsUUID()
  @IsNotEmpty()
  music_library_id: string;

  @IsOptional()
  @Type(() => String)
  filename?: string;

  constructor(props: DownloadSyncedLyricsForMusicLibraryInputConstructorProps) {
    this.musician_id = props.musician_id;
    this.music_library_id = props.music_library_id;
    this.filename = props.filename;
  }
}

export class ValidateDownloadSyncedLyricsForMusicLibraryInput {
  static validate(input: DownloadSyncedLyricsForMusicLibraryInput) {
    return validateSync(input);
  }
}
