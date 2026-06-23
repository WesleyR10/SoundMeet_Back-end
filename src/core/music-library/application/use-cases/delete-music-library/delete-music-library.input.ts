import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type DeleteMusicLibraryInputConstructorProps = {
  id: string;
};

export class DeleteMusicLibraryInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  constructor(props: DeleteMusicLibraryInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
  }
}

export class ValidateDeleteMusicLibraryInput {
  static validate(input: DeleteMusicLibraryInput) {
    return validateSync(input);
  }
}
