import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  validateSync,
} from "class-validator";

export type UpsertSyncedLyricsForMusicLibraryInputConstructorProps = {
  musician_id: string;
  music_library_id: string;
  raw: string;
  provider: string;
  provider_meta?: Record<string, unknown> | null;
  pipeline_version?: number;
};

export class UpsertSyncedLyricsForMusicLibraryInput {
  @IsString()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  music_library_id: string;

  @IsString()
  @IsNotEmpty()
  raw: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider: string;

  @IsOptional()
  @IsObject()
  provider_meta?: Record<string, unknown> | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  pipeline_version?: number;

  constructor(props: UpsertSyncedLyricsForMusicLibraryInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.music_library_id = props.music_library_id;
    this.raw = props.raw;
    this.provider = props.provider;
    this.provider_meta = props.provider_meta ?? null;
    this.pipeline_version = props.pipeline_version;
  }
}

export class ValidateUpsertSyncedLyricsForMusicLibraryInput {
  static validate(input: UpsertSyncedLyricsForMusicLibraryInput) {
    return validateSync(input);
  }
}
