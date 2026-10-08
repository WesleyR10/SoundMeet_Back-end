import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import { PresenceLocationInput } from "../../../../events/application/use-cases/common/presence-location.input";
import { CreateRequestBoostInput } from "../../../../request/application/use-cases/create-request/create-request.input";

export type MakeMusicRequestInput = {
  id: string;
  musician_id: string;
  song_title: string;
  artist_name: string;
  genre?: string;
  difficulty?: string;
  event_id?: string;
  establishment_id?: string;
  message?: string;
  /**
   * Destaque pago.
   *
   * 🔴 Substitui o antigo `is_priority`, que era campo FANTASMA: o cliente
   * mandava `true`, a API ecoava `true` em `request_metadata` e nada era
   * persistido — não chegava ao `CreateRequestUseCase` nem ao agregado. Além
   * de morto, era prioridade afirmada pelo próprio cliente. A prioridade real
   * agora custa dinheiro e é verificada pelo domínio.
   */
  boost?: { amount: number; dedication?: string } | null;
  /** Leitura de GPS no ato do pedido — ver `AudienceMustBePresentPolicy`. */
  location?: {
    latitude: number;
    longitude: number;
    accuracy_m: number;
    mocked?: boolean;
  } | null;
  metadata?: Record<string, any>;
};

export class MakeMusicRequestInputValidator {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  song_title: string;

  @IsString()
  @IsNotEmpty()
  artist_name: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsString()
  @IsOptional()
  event_id?: string;

  @IsString()
  @IsOptional()
  establishment_id?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @ValidateNested()
  @Type(() => CreateRequestBoostInput)
  @IsOptional()
  boost?: CreateRequestBoostInput | null;

  @ValidateNested()
  @Type(() => PresenceLocationInput)
  @IsOptional()
  location?: PresenceLocationInput | null;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  constructor(props: MakeMusicRequestInput) {
    Object.assign(this, props);
  }
}
