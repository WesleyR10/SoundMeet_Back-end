import { IsInt, IsUUID, Max, Min } from "class-validator";

import { LocationInput } from "../update-musician-profile/update-musician-profile.input";

export class SetMusicianTouringLocationInput extends LocationInput {
  @IsUUID()
  id: string;

  // Duração da ativação (7.13d) — teto de MAX_TOURING_DAYS aplicado também
  // no aggregate (defesa em profundidade); aqui é a validação de borda HTTP.
  @IsInt()
  @Min(1)
  @Max(30)
  duration_days: number;
}
