import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  validateSync,
} from "class-validator";

export type MarkRequestPlayedInputConstructorProps = {
  request_id: string;
  played_at?: string;
  musician_id?: string;
};

export class MarkRequestPlayedInput {
  @IsUUID()
  @IsNotEmpty()
  request_id: string;

  @IsDateString()
  @IsOptional()
  played_at?: string;

  @IsUUID()
  @IsOptional()
  musician_id?: string;

  constructor(props: MarkRequestPlayedInputConstructorProps) {
    if (!props) return;

    this.request_id = props.request_id;
    this.played_at = props.played_at;
    this.musician_id = props.musician_id;
  }
}

export class ValidateMarkRequestPlayedInput {
  static validate(input: MarkRequestPlayedInput) {
    return validateSync(input);
  }
}
