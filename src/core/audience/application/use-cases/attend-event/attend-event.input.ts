import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

import { PresenceLocationInput } from "../../../../events/application/use-cases/common/presence-location.input";

export class AttendEventInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  event_id: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  establishment_id?: string;

  /**
   * Leitura de GPS no ato do check-in. Opcional no contrato para que a
   * ausência vire a mensagem certa ("ative a localização") no use-case de
   * presença, e não um 422 genérico de campo obrigatório.
   */
  @ValidateNested()
  @Type(() => PresenceLocationInput)
  @IsOptional()
  location?: PresenceLocationInput;
}
