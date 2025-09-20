import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type GetMusicianInputConstructorProps = {
  id: string;
};

export class GetMusicianInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  constructor(props: GetMusicianInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
  }
}

export class ValidateGetMusicianInput {
  static validate(input: GetMusicianInput) {
    return validateSync(input);
  }
}
