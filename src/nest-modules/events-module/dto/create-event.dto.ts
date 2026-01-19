import { OmitType } from "@nestjs/swagger";

import { CreateEventInput } from "../../../core/events/application/use-cases/create-event/create-event.input";

export class CreateEventInputWithoutEstablishmentId extends OmitType(
  CreateEventInput,
  ["establishment_id"] as const,
) {}

export class CreateEventDto extends CreateEventInputWithoutEstablishmentId {}
