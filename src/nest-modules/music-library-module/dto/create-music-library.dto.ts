import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { CreateMusicLibraryInput } from "../../../core/music-library/application/use-cases/create-music-library/create-music-library.input";

export class CreateMusicLibraryDto extends CreateMusicLibraryInput {
  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Ignorado para músicos — preenchido automaticamente do JWT. Admin pode especificar outro musician_id.",
  })
  declare musician_id: string;

  @ApiProperty()
  declare title: string;

  @ApiProperty()
  declare artist: string;

  @ApiPropertyOptional({ nullable: true })
  declare genre?: string | null;

  @ApiPropertyOptional({ nullable: true })
  declare key?: string | null;

  @ApiPropertyOptional({ nullable: true })
  declare bpm?: number | null;

  @ApiPropertyOptional({ nullable: true })
  declare lyrics?: string | null;

  @ApiPropertyOptional({ nullable: true })
  declare notes?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  declare difficulty?: number;

  @ApiPropertyOptional()
  declare is_favorite?: boolean;

  @ApiPropertyOptional({ nullable: true })
  declare source?: string | null;

  @ApiPropertyOptional({ nullable: true })
  declare source_id?: string | null;
}
