import { OmitType } from "@nestjs/swagger";

import { UpdateBandInput } from "../../../core/musician/application/use-cases/update-band/update-band.input";

/**
 * `id` vem da URL; `requesting_musician_id` e `is_admin` vêm do JWT. Nenhum
 * dos três pode chegar pelo corpo.
 */
export class UpdateBandDto extends OmitType(UpdateBandInput, [
  "id",
  "requesting_musician_id",
  "is_admin",
] as const) {}
