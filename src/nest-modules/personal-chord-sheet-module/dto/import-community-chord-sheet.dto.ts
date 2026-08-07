import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ImportCommunityChordSheetDto {
  @ApiProperty({
    format: "uuid",
    description:
      "A cópia DO IMPORTADOR da música. As correções do autor são reancoradas contra esta análise, não copiadas às cegas.",
  })
  @IsUUID("4")
  target_music_library_id: string;
}
