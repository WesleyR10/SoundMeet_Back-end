import { OmitType } from "@nestjs/swagger";

import { UpdateEstablishmentProfileInput } from "../../../core/establishment/application/use-cases/update-establishment-profile/update-establishment-profile.input";

export class UpdateEstablishmentProfileInputWithoutId extends OmitType(
  UpdateEstablishmentProfileInput,
  ["id"] as const,
) {}

export class UpdateEstablishmentProfileDto extends UpdateEstablishmentProfileInputWithoutId {}
