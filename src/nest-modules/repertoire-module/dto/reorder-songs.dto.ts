import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class ReorderSongsDto {
  @ApiProperty({
    type: [String],
    description: "Array de song_ids na nova ordem desejada (deve conter todos os IDs)",
    example: ["uuid-1", "uuid-2", "uuid-3"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  ordered_song_ids: string[];
}
