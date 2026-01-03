import { OmitType } from "@nestjs/swagger";

import { CancelBookingInput } from "../../../core/scheduling/application/use-cases/cancel-booking/cancel-booking.input";

export class CancelBookingInputWithoutId extends OmitType(CancelBookingInput, [
  "booking_id",
] as const) {}

export class CancelBookingDto extends CancelBookingInputWithoutId {}
