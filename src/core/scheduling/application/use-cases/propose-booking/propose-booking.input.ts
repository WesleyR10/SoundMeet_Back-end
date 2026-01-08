import { Type } from "class-transformer";
import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  validateSync,
} from "class-validator";

export type ProposeBookingInputConstructorProps = {
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  start_at: Date;
  end_at: Date;
  fee?: number | null;
  notes?: string | null;
  buffer_minutes?: number;
  expires_at?: Date | null;
};

export class ProposeBookingInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  establishment_id: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  musician_id?: string | null;

  @IsString()
  @IsOptional()
  @IsUUID()
  band_id?: string | null;

  @IsString()
  @IsOptional()
  @IsUUID()
  event_id?: string | null;

  @Type(() => Date)
  @IsDate()
  start_at: Date;

  @Type(() => Date)
  @IsDate()
  end_at: Date;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fee?: number | null;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  buffer_minutes?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires_at?: Date | null;

  constructor(props: ProposeBookingInputConstructorProps) {
    if (!props) return;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.event_id = props.event_id;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.fee = props.fee;
    this.notes = props.notes;
    this.buffer_minutes = props.buffer_minutes;
    this.expires_at = props.expires_at;
  }
}

export class ValidateProposeBookingInput {
  static validate(input: ProposeBookingInput) {
    return validateSync(input);
  }
}
