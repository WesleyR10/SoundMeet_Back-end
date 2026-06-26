import { IsNotEmpty, IsOptional, IsString, validateSync } from "class-validator";

export type DeleteMusicLibraryInputConstructorProps = {
  id: string;
  requesting_musician_id?: string;
  is_admin?: boolean;
};

export class DeleteMusicLibraryInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  requesting_musician_id?: string;

  is_admin?: boolean;

  constructor(props: DeleteMusicLibraryInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin;
  }
}

export class ValidateDeleteMusicLibraryInput {
  static validate(input: DeleteMusicLibraryInput) {
    return validateSync(input);
  }
}
