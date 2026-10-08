import { OmitType } from "@nestjs/mapped-types";

import { RejectInquiryInput } from "../../../core/scheduling/application/use-cases/reject-inquiry/reject-inquiry.input";

/**
 * Só `reason` vem do corpo. `inquiry_id` é o `:id` da URL e o ator vem do JWT —
 * sem o `OmitType`, o `@IsUUID()` herdado do Input exigia o id no corpo e todo
 * pedido legítimo levava 422 (ver `inquiry-route-body.dto.spec.ts`).
 */
export class RejectInquiryDto extends OmitType(RejectInquiryInput, [
  "inquiry_id",
  "requesting_participant_ids",
  "requesting_musician_id",
  "is_admin",
] as const) {}
