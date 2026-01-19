import { OmitType } from "@nestjs/swagger";

import { RespondToRequestInput } from "../../../core/request/application/use-cases/respond-to-request/respond-to-request.input";

export class RespondToRequestInputWithoutRequestId extends OmitType(
  RespondToRequestInput,
  ["request_id"] as const,
) {}

export class RespondToRequestDto extends RespondToRequestInputWithoutRequestId {}
