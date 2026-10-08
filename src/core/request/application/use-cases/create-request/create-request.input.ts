import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
  validateSync,
} from "class-validator";

import { PresenceLocationInput } from "../../../../events/application/use-cases/common/presence-location.input";
import { REQUEST_BOOST_DEDICATION_MAX_LENGTH } from "../../../domain/value-objects/request-boost.vo";

/**
 * Destaque pago do pedido.
 *
 * 🔴 O valor entra como PROMESSA — a cobrança só é criada quando o músico
 * aceita. Ver `RequestBoost` e `RespondToRequestUseCase`.
 *
 * O piso não é validado aqui: mora em config (`REQUEST_BOOST_MIN_AMOUNT`) e é
 * cobrado por `BoostMinimumAmountPolicy`, junto com as demais regras de
 * elegibilidade — assim a mensagem de erro sai no mesmo formato das outras.
 */
export class CreateRequestBoostInput {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  @MaxLength(REQUEST_BOOST_DEDICATION_MAX_LENGTH, {
    message: `Dedication cannot exceed ${REQUEST_BOOST_DEDICATION_MAX_LENGTH} characters`,
  })
  dedication?: string;
}

export type CreateRequestInputConstructorProps = {
  event_id: string;
  audience_id: string;
  musician_id: string;
  library_id?: string | null;
  song_title: string;
  artist?: string;
  message?: string;
  boost?: { amount: number; dedication?: string } | null;
  location?: {
    latitude: number;
    longitude: number;
    accuracy_m: number;
    mocked?: boolean;
  } | null;
};

export class CreateRequestInput {
  @IsUUID()
  @IsNotEmpty()
  event_id: string;

  @IsUUID()
  @IsNotEmpty()
  audience_id: string;

  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsUUID()
  @IsOptional()
  library_id?: string | null;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: "Song title must have at least 1 character" })
  @MaxLength(200, { message: "Song title cannot exceed 200 characters" })
  song_title: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: "Artist name cannot exceed 100 characters" })
  artist?: string;

  @IsString()
  @IsOptional()
  @MinLength(1, { message: "Message must have at least 1 character" })
  @MaxLength(500, { message: "Message cannot exceed 500 characters" })
  message?: string;

  @ValidateNested()
  @Type(() => CreateRequestBoostInput)
  @IsOptional()
  boost?: CreateRequestBoostInput | null;

  /**
   * Leitura de GPS feita no ato do pedido. Opcional no CONTRATO só para que a
   * ausência chegue à policy e vire a mensagem certa ("ative a localização"),
   * e não um 422 genérico de campo obrigatório. Sem ela o pedido é recusado —
   * ver `AudienceMustBePresentPolicy`.
   */
  @ValidateNested()
  @Type(() => PresenceLocationInput)
  @IsOptional()
  location?: PresenceLocationInput | null;

  constructor(props: CreateRequestInputConstructorProps) {
    if (!props) return;

    this.event_id = props.event_id;
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.library_id = props.library_id;
    this.song_title = props.song_title;
    this.artist = props.artist;
    this.message = props.message;
    if (props.boost) {
      this.boost = Object.assign(new CreateRequestBoostInput(), {
        amount: props.boost.amount,
        dedication: props.boost.dedication,
      });
    }
    if (props.location) {
      this.location = Object.assign(
        new PresenceLocationInput(),
        props.location,
      );
    }
  }
}

export class ValidateCreateRequestInput {
  static validate(input: CreateRequestInput) {
    return validateSync(input);
  }
}
