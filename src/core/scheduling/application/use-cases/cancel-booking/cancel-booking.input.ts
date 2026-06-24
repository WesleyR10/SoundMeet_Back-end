import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type CancelBookingInputConstructorProps = {
  booking_id: string;
  cancelled_by: "establishment" | "musician" | "band";
  requesting_user_id?: string | null;
  is_admin?: boolean;
  reason?: string | null;
};

export class CancelBookingInput {
  @IsString()
  @IsUUID()
  booking_id: string;

  @IsString()
  @IsIn(["establishment", "musician", "band"])
  cancelled_by: "establishment" | "musician" | "band";

  @IsString()
  @IsUUID()
  @IsOptional()
  requesting_user_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  @IsString()
  @IsOptional()
  reason?: string | null;

  constructor(props: CancelBookingInputConstructorProps) {
    if (!props) return;
    this.booking_id = props.booking_id;
    this.cancelled_by = props.cancelled_by;
    this.requesting_user_id = props.requesting_user_id;
    this.is_admin = props.is_admin ?? false;
    this.reason = props.reason;
  }
}

export class ValidateCancelBookingInput {
  static validate(input: CancelBookingInput) {
    return validateSync(input);
  }
}
