import { OmitType } from "@nestjs/swagger";

import { SetBandOpenToGigsInput } from "../../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.input";

/** `band_id` vem da URL; `requesting_musician_id` e `is_admin` vêm do JWT. */
export class SetBandOpenToGigsDto extends OmitType(SetBandOpenToGigsInput, [
  "band_id",
  "requesting_musician_id",
  "is_admin",
] as const) {}
