import { OmitType } from "@nestjs/swagger";

import { UpdateMusicianProfileInput } from "../../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.input";

export class UpdateMusicianProfileInputWithoutId extends OmitType(
  UpdateMusicianProfileInput,
  ["id"] as const,
) {}

export class UpdateMusicianProfileDto extends UpdateMusicianProfileInputWithoutId {}
