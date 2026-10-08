import { OmitType } from "@nestjs/mapped-types";

import { ConvertInquiryToBookingInput } from "../../../core/scheduling/application/use-cases/convert-inquiry-to-booking/convert-inquiry-to-booking.input";

/**
 * `inquiry_id` é o `:id` da URL; ator e `proposed_by` vêm do JWT. Sem o
 * `OmitType`, o `@IsUUID()` herdado do Input exigia o id no corpo e a conversão
 * levava 422 para todo corpo legítimo (ver `inquiry-route-body.dto.spec.ts`).
 */
export class ConvertInquiryToBookingDto extends OmitType(
  ConvertInquiryToBookingInput,
  [
    "inquiry_id",
    "requesting_participant_ids",
    "requesting_musician_id",
    "is_admin",
    "proposed_by",
  ] as const,
) {}
