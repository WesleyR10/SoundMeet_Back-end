import { OmitType } from "@nestjs/swagger";

import { UpdateBandInput } from "../../../core/musician/application/use-cases/update-band/update-band.input";

export class UpdateBandInputWithoutId extends OmitType(UpdateBandInput, [
  "id",
] as const) {}

export class UpdateBandDto extends UpdateBandInputWithoutId {}
