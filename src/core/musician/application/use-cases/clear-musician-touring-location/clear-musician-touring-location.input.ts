import { IsUUID } from "class-validator";

export class ClearMusicianTouringLocationInput {
  @IsUUID()
  id: string;
}
