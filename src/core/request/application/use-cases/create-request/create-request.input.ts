import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  validateSync,
} from "class-validator";

export type CreateRequestInputConstructorProps = {
  audience_id: string;
  musician_id: string;
  song_title: string;
  artist?: string;
  message?: string;
};

export class CreateRequestInput {
  @IsUUID()
  @IsNotEmpty()
  audience_id: string;

  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: "Song title must have at least 1 character" })
  @MaxLength(200, { message: "Song title cannot exceed 200 characters" })
  song_title: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: "Artist name cannot exceed 100 characters" })
  artist?: string;

  @IsString()
  @IsOptional()
  @MinLength(1, { message: "Message must have at least 1 character" })
  @MaxLength(500, { message: "Message cannot exceed 500 characters" })
  message?: string;

  constructor(props: CreateRequestInputConstructorProps) {
    if (!props) return;

    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.song_title = props.song_title;
    this.artist = props.artist;
    this.message = props.message;
  }
}

export class ValidateCreateRequestInput {
  static validate(input: CreateRequestInput) {
    return validateSync(input);
  }
}
