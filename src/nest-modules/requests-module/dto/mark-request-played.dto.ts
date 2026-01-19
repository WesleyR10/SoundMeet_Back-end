import { OmitType } from "@nestjs/swagger";

import { MarkRequestPlayedInput } from "../../../core/request/application/use-cases/mark-request-played/mark-request-played.input";

export class MarkRequestPlayedInputWithoutRequestId extends OmitType(
  MarkRequestPlayedInput,
  ["request_id"] as const,
) {}

export class MarkRequestPlayedDto extends MarkRequestPlayedInputWithoutRequestId {}
