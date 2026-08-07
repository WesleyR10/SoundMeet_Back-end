import { OmitType } from "@nestjs/swagger";

import { CancelBookingInput } from "../../../core/scheduling/application/use-cases/cancel-booking/cancel-booking.input";

export class CancelBookingInputBody extends OmitType(CancelBookingInput, [
  "booking_id",
  "cancelled_by",
  "requesting_participant_ids",
  "is_admin",
] as const) {}

export class CancelBookingDto extends CancelBookingInputBody {}
