import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

import { PresenceLocationInput } from "../../../core/events/application/use-cases/common/presence-location.input";

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

  @ApiPropertyOptional({
    type: PresenceLocationInput,
    description:
      "Leitura de GPS do fã no ato. Obrigatória quando quem chama é o próprio fã (audience); ignorada para establishment/admin.",
  })
  @ValidateNested()
  @Type(() => PresenceLocationInput)
  @IsOptional()
  location?: PresenceLocationInput;
}
