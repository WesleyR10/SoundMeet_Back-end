import { OmitType } from "@nestjs/swagger";

import { AttendEventInput } from "../../../core/audience/application/use-cases/attend-event/attend-event.input";

export class AttendEventInputWithoutAudienceId extends OmitType(
  AttendEventInput,
  ["audience_id"] as const,
) {}

export class AttendEventDto extends AttendEventInputWithoutAudienceId {}
