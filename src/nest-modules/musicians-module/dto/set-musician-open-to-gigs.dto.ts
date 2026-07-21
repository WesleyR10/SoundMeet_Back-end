import { OmitType } from "@nestjs/swagger";

import { SetMusicianOpenToGigsInput } from "../../../core/musician/application/use-cases/set-musician-open-to-gigs/set-musician-open-to-gigs.input";

export class SetMusicianOpenToGigsInputWithoutId extends OmitType(
  SetMusicianOpenToGigsInput,
  ["id"] as const,
) {}

export class SetMusicianOpenToGigsDto extends SetMusicianOpenToGigsInputWithoutId {}
