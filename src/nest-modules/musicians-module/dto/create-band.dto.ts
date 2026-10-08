import { OmitType } from "@nestjs/swagger";

import { CreateBandInput } from "../../../core/musician/application/use-cases/create-band/create-band.input";

/**
 * `creator_musician_id` vem do JWT — quem lidera a banda é quem está
 * autenticado, nunca um id escolhido no corpo.
 */
export class CreateBandDto extends OmitType(CreateBandInput, [
  "creator_musician_id",
] as const) {}
