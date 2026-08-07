import { OmitType } from "@nestjs/swagger";

import { SetAvailabilitySettingsInput } from "../../../core/scheduling/application/use-cases/set-availability-settings/set-availability-settings.input";

export class SetAvailabilitySettingsDto extends OmitType(
  SetAvailabilitySettingsInput,
  ["musician_id"] as const,
) {}
