import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type UpdateRequestInputConstructorProps = {
  id: string;
  song_title?: string;
  artist?: string;
  message?: string;
};

export class UpdateRequestInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  song_title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  artist?: string;

  @IsOptional()
  @IsString()
  message?: string;

  constructor(props: UpdateRequestInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    props.song_title !== undefined && (this.song_title = props.song_title);
    props.artist !== undefined && (this.artist = props.artist);
    props.message !== undefined && (this.message = props.message);
  }
}

export class ValidateUpdateRequestInput {
  static validate(input: UpdateRequestInput) {
    return validateSync(input);
  }
}
