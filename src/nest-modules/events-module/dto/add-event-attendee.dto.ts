import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";

export class AddEventAttendeeDto {
  @ApiPropertyOptional({
    format: "uuid",
    description:
      "ID da audiência (apenas para establishment/admin; audiences usam o próprio JWT).",
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  audience_id?: string;
}
