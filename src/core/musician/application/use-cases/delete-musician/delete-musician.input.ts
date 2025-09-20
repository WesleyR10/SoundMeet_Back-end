import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type DeleteMusicianInputConstructorProps = {
  id: string;
};

export class DeleteMusicianInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  constructor(props: DeleteMusicianInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
  }
}

export class ValidateDeleteMusicianInput {
  static validate(input: DeleteMusicianInput) {
    return validateSync(input);
  }
}
