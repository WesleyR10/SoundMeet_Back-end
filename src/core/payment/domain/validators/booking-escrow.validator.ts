import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../../shared/domain/validators/notification";
import { BookingEscrow } from "../booking-escrow.aggregate";
import { BookingEscrowStatus } from "../booking-escrow-enums";

export class BookingEscrowRules {
  @IsString()
  @IsNotEmpty()
  escrow_id: string;

  @IsString()
  @IsNotEmpty()
  booking_id: string;

  @IsString()
  @IsOptional()
  musician_id?: string | null;

  /**
   * Custódia de R$0 não existe — seria um registro sem objeto. E `Min(1)` é o
   * mesmo piso do `Tip`: abaixo disso o valor não paga nem a tarifa do
   * provedor.
   */
  @IsNumber()
  @Min(1)
  amount: number;

  @IsNumber()
  @Min(0)
  platform_fee: number;

  /**
   * O que sobra para o músico. `Min(0)` e não `Min(1)`: uma comissão de 100% é
   * absurda, mas o teto de sanidade é o `platform_fee` do plano, não este
   * validador — aqui só garantimos que a conta não fica negativa.
   */
  @IsNumber()
  @Min(0)
  net_amount: number;

  @IsEnum(BookingEscrowStatus)
  status: BookingEscrowStatus;

  @IsString()
  @IsOptional()
  external_id?: string | null;

  @IsDate()
  @IsOptional()
  expires_at?: Date | null;

  @IsDate()
  created_at: Date;

  constructor(entity: BookingEscrow) {
    Object.assign(this, {
      escrow_id: entity.escrow_id.id,
      booking_id: entity.booking_id.id,
      musician_id: entity.musician_id?.id ?? null,
      amount: entity.amount.amount,
      platform_fee: entity.platform_fee.amount,
      net_amount: entity.net_amount.amount,
      status: entity.status,
      external_id: entity.external_id,
      expires_at: entity.expires_at,
      created_at: entity.created_at,
    });
  }
}

export class BookingEscrowValidator extends ClassValidatorFields {
  /**
   * ⚠️ `[]` quando não vêm campos, e **nunca** `Object.keys(rules)`.
   *
   * `ClassValidatorFields` repassa `fields` como `groups` do class-validator.
   * Nomes de propriedade não são grupos declarados em decorator nenhum, então
   * o filtro derruba toda a metadata e o validador responde
   * *"an unknown value was passed to the validate function"* — um erro que
   * parece de tipo e na verdade é de configuração, e que faz TODO agregado
   * nascer inválido. Lista vazia significa "sem filtro de grupo", que é o
   * comportamento pretendido. Mesmo padrão de `TipValidator`.
   */
  validate(
    notification: Notification,
    data: BookingEscrow,
    fields?: string[],
  ): boolean {
    const newFields = fields?.length ? fields : [];
    return super.validate(
      notification,
      new BookingEscrowRules(data),
      newFields,
    );
  }
}

export class BookingEscrowValidatorFactory {
  static create() {
    return new BookingEscrowValidator();
  }
}
