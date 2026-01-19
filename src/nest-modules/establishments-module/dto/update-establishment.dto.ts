import { OmitType } from "@nestjs/swagger";

import { UpdateEstablishmentInput } from "../../../core/establishment/application/use-cases/update-establishment/update-establishment.input";

export class UpdateEstablishmentInputWithoutId extends OmitType(
  UpdateEstablishmentInput,
  ["id"] as const,
) {}

export class UpdateEstablishmentDto extends UpdateEstablishmentInputWithoutId {}
