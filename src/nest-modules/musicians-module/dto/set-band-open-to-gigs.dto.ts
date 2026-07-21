import { OmitType } from "@nestjs/swagger";

import { SetBandOpenToGigsInput } from "../../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.input";

export class SetBandOpenToGigsInputWithoutId extends OmitType(
  SetBandOpenToGigsInput,
  ["band_id"] as const,
) {}

export class SetBandOpenToGigsDto extends SetBandOpenToGigsInputWithoutId {}
