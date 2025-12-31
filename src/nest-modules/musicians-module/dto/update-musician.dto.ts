import { OmitType } from "@nestjs/swagger";

import { UpdateMusicianInput } from "../../../core/musician/application/use-cases/update-musician/update-musician.input";

export class UpdateMusicianInputWithoutId extends OmitType(
  UpdateMusicianInput,
  ["id"] as const,
) {}

export class UpdateMusicianDto extends UpdateMusicianInputWithoutId {}
