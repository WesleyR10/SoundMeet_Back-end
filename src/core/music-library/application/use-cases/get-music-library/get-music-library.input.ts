import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type GetMusicLibraryInputConstructorProps = {
  id: string;
};

export class GetMusicLibraryInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  constructor(props: GetMusicLibraryInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
  }
}

export class ValidateGetMusicLibraryInput {
  static validate(input: GetMusicLibraryInput) {
    return validateSync(input);
  }
}
