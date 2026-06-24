import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type ConfirmBookingInputConstructorProps = {
  booking_id: string;
  requesting_user_id?: string | null;
  is_admin?: boolean;
};

export class ConfirmBookingInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  booking_id: string;

  @IsString()
  @IsUUID()
  @IsOptional()
  requesting_user_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: ConfirmBookingInputConstructorProps) {
    if (!props) return;
    this.booking_id = props.booking_id;
    this.requesting_user_id = props.requesting_user_id;
    this.is_admin = props.is_admin ?? false;
  }
}

export class ValidateConfirmBookingInput {
  static validate(input: ConfirmBookingInput) {
    return validateSync(input);
  }
}
