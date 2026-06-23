import { OmitType, PartialType } from "@nestjs/swagger";

import { CreateMusicLibraryDto } from "./create-music-library.dto";

export class UpdateMusicLibraryDto extends PartialType(
  OmitType(CreateMusicLibraryDto, ["musician_id"] as const),
) {}
