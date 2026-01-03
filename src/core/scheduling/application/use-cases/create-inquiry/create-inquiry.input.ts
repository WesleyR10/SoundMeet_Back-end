import { Type } from "class-transformer";
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type CreateInquiryInputConstructorProps = {
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  subject?: string | null;
  initial_message?: string | null;
  expires_at?: Date | null;
};

export class CreateInquiryInput {
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

  @IsString()
  @IsOptional()
  subject?: string | null;

  @IsString()
  @IsOptional()
  initial_message?: string | null;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires_at?: Date | null;

  constructor(props: CreateInquiryInputConstructorProps) {
    if (!props) return;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.event_id = props.event_id;
    this.subject = props.subject;
    this.initial_message = props.initial_message;
    this.expires_at = props.expires_at;
  }
}

export class ValidateCreateInquiryInput {
  static validate(input: CreateInquiryInput) {
    return validateSync(input);
  }
}
