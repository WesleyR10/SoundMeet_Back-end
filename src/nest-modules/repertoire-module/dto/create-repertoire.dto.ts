import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateRepertoireDto {
  @ApiProperty({
    example: "uuid-v4",
    description: "ID do músico dono do repertório",
  })
  @IsUUID("4")
  @IsNotEmpty()
  musician_id: string;

  @ApiProperty({ example: "Setlist Principal", maxLength: 255 })
  @MaxLength(255)
  @IsNotEmpty()
  @IsString()
  name: string;
}
