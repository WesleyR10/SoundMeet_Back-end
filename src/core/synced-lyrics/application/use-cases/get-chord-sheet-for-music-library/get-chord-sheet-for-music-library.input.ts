import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type GetChordSheetForMusicLibraryInputConstructorProps = {
  musician_id: string;
  music_library_id: string;
};

export class GetChordSheetForMusicLibraryInput {
  @IsString()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  music_library_id: string;

  constructor(props: GetChordSheetForMusicLibraryInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.music_library_id = props.music_library_id;
  }
}

export class ValidateGetChordSheetForMusicLibraryInput {
  static validate(input: GetChordSheetForMusicLibraryInput) {
    return validateSync(input);
  }
}
