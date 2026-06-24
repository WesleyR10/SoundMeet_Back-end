import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  validateSync,
} from "class-validator";

export type SetAvailabilitySettingsInputConstructorProps = {
  musician_id: string;
  timezone?: string | null;
  default_buffer_minutes?: number | null;
  max_shows_per_day?: number | null;
};

export class SetAvailabilitySettingsInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  musician_id: string;

  @IsString()
  @IsOptional()
  timezone?: string | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  default_buffer_minutes?: number | null;

  @IsNumber()
  @Min(1)
  @IsOptional()
  max_shows_per_day?: number | null;

  constructor(props: SetAvailabilitySettingsInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.timezone = props.timezone;
    this.default_buffer_minutes = props.default_buffer_minutes;
    this.max_shows_per_day = props.max_shows_per_day;
  }
}

export class ValidateSetAvailabilitySettingsInput {
  static validate(input: SetAvailabilitySettingsInput) {
    return validateSync(input);
  }
}
