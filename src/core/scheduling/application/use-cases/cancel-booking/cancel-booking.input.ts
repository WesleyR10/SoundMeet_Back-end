import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type CancelBookingInputConstructorProps = {
  booking_id: string;
  cancelled_by: "establishment" | "musician" | "band";
  reason?: string | null;
};

export class CancelBookingInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  booking_id: string;

  @IsIn(["establishment", "musician", "band"])
  @IsNotEmpty()
  cancelled_by: "establishment" | "musician" | "band";

  @IsString()
  @IsOptional()
  reason?: string | null;

  constructor(props: CancelBookingInputConstructorProps) {
    if (!props) return;
    this.booking_id = props.booking_id;
    this.cancelled_by = props.cancelled_by;
    this.reason = props.reason;
  }
}

export class ValidateCancelBookingInput {
  static validate(input: CancelBookingInput) {
    return validateSync(input);
  }
}
