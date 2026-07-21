import { OmitType } from "@nestjs/swagger";

import { SetMusicianTouringLocationInput } from "../../../core/musician/application/use-cases/set-musician-touring-location/set-musician-touring-location.input";

export class SetMusicianTouringLocationInputWithoutId extends OmitType(
  SetMusicianTouringLocationInput,
  ["id"] as const,
) {}

export class SetMusicianTouringLocationDto extends SetMusicianTouringLocationInputWithoutId {}
