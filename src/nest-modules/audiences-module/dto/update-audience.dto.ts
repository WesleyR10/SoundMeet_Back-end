import { OmitType } from "@nestjs/swagger";

import { UpdateAudienceInput } from "../../../core/audience/application/use-cases/update-audience/update-audience.input";

export class UpdateAudienceInputWithoutId extends OmitType(
  UpdateAudienceInput,
  ["id"] as const,
) {}

export class UpdateAudienceDto extends UpdateAudienceInputWithoutId {}
