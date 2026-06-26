import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RenameRepertoireDto {
  @ApiProperty({ example: "Setlist de Verão", maxLength: 255 })
  @MaxLength(255)
  @IsNotEmpty()
  @IsString()
  name: string;
}
