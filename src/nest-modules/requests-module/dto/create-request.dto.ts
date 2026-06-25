import { OmitType } from "@nestjs/swagger";

import { CreateRequestInput } from "../../../core/request/application/use-cases/create-request/create-request.input";

export class CreateRequestDto extends OmitType(CreateRequestInput, [
  "audience_id",
] as const) {}
