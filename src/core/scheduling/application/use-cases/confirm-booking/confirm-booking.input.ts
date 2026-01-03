import { IsNotEmpty, IsString, IsUUID, validateSync } from "class-validator";

export type ConfirmBookingInputConstructorProps = {
  booking_id: string;
};

export class ConfirmBookingInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  booking_id: string;

  constructor(props: ConfirmBookingInputConstructorProps) {
    if (!props) return;
    this.booking_id = props.booking_id;
  }
}

export class ValidateConfirmBookingInput {
  static validate(input: ConfirmBookingInput) {
    return validateSync(input);
  }
}
