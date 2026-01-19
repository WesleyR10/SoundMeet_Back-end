import { OmitType } from "@nestjs/swagger";

import { UpdateEventInput } from "../../../core/events/application/use-cases/update-event/update-event.input";

export class UpdateEventInputWithoutIds extends OmitType(UpdateEventInput, [
  "id",
  "establishment_id",
] as const) {}

export class UpdateEventDto extends UpdateEventInputWithoutIds {}
