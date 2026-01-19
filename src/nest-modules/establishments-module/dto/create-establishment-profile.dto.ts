import { OmitType } from "@nestjs/swagger";

import { CreateEstablishmentProfileInput } from "../../../core/establishment/application/use-cases/create-establishment-profile/create-establishment-profile.input";

export class CreateEstablishmentProfileInputWithoutId extends OmitType(
  CreateEstablishmentProfileInput,
  ["id"] as const,
) {}

export class CreateEstablishmentProfileDto extends CreateEstablishmentProfileInputWithoutId {}
