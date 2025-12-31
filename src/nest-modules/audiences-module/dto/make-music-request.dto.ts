import { OmitType } from "@nestjs/swagger";

import { MakeMusicRequestInputValidator } from "../../../core/audience/application/use-cases/make-music-request/make-music-request.input";

export class MakeMusicRequestInputWithoutId extends OmitType(
  MakeMusicRequestInputValidator,
  ["id"] as const,
) {}

export class MakeMusicRequestDto extends MakeMusicRequestInputWithoutId {}
