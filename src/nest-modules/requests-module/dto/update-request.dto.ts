import { OmitType } from "@nestjs/swagger";

import { UpdateRequestInput } from "../../../core/request/application/use-cases/update-request/update-request.input";

export class UpdateRequestInputWithoutId extends OmitType(UpdateRequestInput, [
  "id",
] as const) {}

export class UpdateRequestDto extends UpdateRequestInputWithoutId {}
