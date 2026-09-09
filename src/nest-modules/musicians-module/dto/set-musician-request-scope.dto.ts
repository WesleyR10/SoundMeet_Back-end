import { OmitType } from "@nestjs/swagger";

import { SetMusicianRequestScopeInput } from "../../../core/musician/application/use-cases/set-musician-request-scope/set-musician-request-scope.input";

export class SetMusicianRequestScopeInputWithoutId extends OmitType(
  SetMusicianRequestScopeInput,
  ["id"] as const,
) {}

export class SetMusicianRequestScopeDto extends SetMusicianRequestScopeInputWithoutId {}
