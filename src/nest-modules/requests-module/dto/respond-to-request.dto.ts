import { OmitType } from "@nestjs/swagger";

import { RespondToRequestInput } from "../../../core/request/application/use-cases/respond-to-request/respond-to-request.input";

export class RespondToRequestInputWithoutIds extends OmitType(
  RespondToRequestInput,
  ["request_id", "musician_id"] as const,
) {}

export class RespondToRequestDto extends RespondToRequestInputWithoutIds {}
