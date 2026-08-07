import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ForkChordSheetDto {
  @ApiProperty({
    format: "uuid",
    description:
      "Música do acervo do próprio músico que será a base da cifra pessoal.",
  })
  @IsUUID("4")
  music_library_id: string;
}
