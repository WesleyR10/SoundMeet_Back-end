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
  requesting_participant_ids?: string[] | null;
  requesting_musician_id?: string | null;
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

  // Identidade do ator: `sub` + claims `establishment_ids`/`band_ids`. Um id só
  // não serve — estabelecimento e banda têm UUID próprio, distinto do `sub`.
  @IsUUID("4", { each: true })
  @IsOptional()
  requesting_participant_ids?: string[] | null;

  // `sub` do JWT, separado dos claims: representar a banda não é decidir por
  // ela — a liderança é checada contra este id (ver negotiation-actor.ts).
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

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
    this.requesting_participant_ids = props.requesting_participant_ids;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
    this.reason = props.reason;
  }
}

export class ValidateCancelBookingInput {
  static validate(input: CancelBookingInput) {
    return validateSync(input);
  }
}
