import { OmitType } from "@nestjs/swagger";

import { CompleteProfileInput } from "../../../core/audience/application/use-cases/complete-profile/complete-profile.input";

export class CompleteProfileInputWithoutAudienceId extends OmitType(
  CompleteProfileInput,
  ["audience_id"] as const,
) {}

export class CompleteProfileDto extends CompleteProfileInputWithoutAudienceId {}
