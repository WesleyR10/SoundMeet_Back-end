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

export type ConvertInquiryToBookingInputConstructorProps = {
  inquiry_id: string;
  start_at: Date;
  end_at: Date;
  fee?: number | null;
  notes?: string | null;
  buffer_minutes?: number;
  expires_at?: Date | null;
  free_cancellation_hours?: number;
};

export class ConvertInquiryToBookingInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  inquiry_id: string;

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

  @IsInt()
  @Min(0)
  @IsOptional()
  free_cancellation_hours?: number;

  constructor(props: ConvertInquiryToBookingInputConstructorProps) {
    if (!props) return;
    this.inquiry_id = props.inquiry_id;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.fee = props.fee;
    this.notes = props.notes;
    this.buffer_minutes = props.buffer_minutes;
    this.expires_at = props.expires_at;
    this.free_cancellation_hours = props.free_cancellation_hours;
  }
}

export class ValidateConvertInquiryToBookingInput {
  static validate(input: ConvertInquiryToBookingInput) {
    return validateSync(input);
  }
}
