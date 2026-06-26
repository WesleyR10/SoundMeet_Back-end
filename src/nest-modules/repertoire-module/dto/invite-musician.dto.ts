import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class InviteMusicianDto {
  @ApiProperty({ example: "uuid-v4", description: "ID do músico a ser convidado" })
  @IsUUID("4")
  @IsNotEmpty()
  invitee_musician_id: string;
}
