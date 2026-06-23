import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type GetRenderableChordSheetForMusicLibraryInputConstructorProps = {
  musician_id: string;
  music_library_id: string;
};

export class GetRenderableChordSheetForMusicLibraryInput {
  @IsString()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  music_library_id: string;

  constructor(
    props: GetRenderableChordSheetForMusicLibraryInputConstructorProps,
  ) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.music_library_id = props.music_library_id;
  }
}

export class ValidateGetRenderableChordSheetForMusicLibraryInput {
  static validate(input: GetRenderableChordSheetForMusicLibraryInput) {
    return validateSync(input);
  }
}
