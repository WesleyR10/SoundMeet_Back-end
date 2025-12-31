import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../../shared/domain/validators/notification";
import { Tip } from "../tip.entity";
import { PaymentMethod, TipStatus } from "../tip-enums";

export class TipRules {
  @IsString()
  @IsNotEmpty()
  tip_id: string;

  @IsString()
  @IsNotEmpty()
  audience_id: string;

  @IsString()
  @IsOptional()
  musician_id?: string | null;

  @IsString()
  @IsOptional()
  band_id?: string | null;

  @IsString()
  @IsOptional()
  event_id?: string | null;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  message?: string | null;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsEnum(TipStatus)
  status: TipStatus;

  @IsString()
  @IsOptional()
  transaction_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_anonymous?: boolean;

  @IsBoolean()
  @IsOptional()
  show_in_wall?: boolean;

  @IsDate()
  @IsOptional()
  created_at?: Date;

  @IsDate()
  @IsOptional()
  updated_at?: Date;

  constructor(entity: Tip) {
    this.tip_id = entity.tip_id.id;
    this.audience_id = entity.audience_id.id;
    this.musician_id = entity.musician_id?.id || null;
    this.band_id = entity.band_id?.id || null;
    this.event_id = entity.event_id?.id || null;
    this.amount = entity.amount.amount;
    this.message = entity.message;
    this.payment_method = entity.payment_method;
    this.status = entity.status;
    this.transaction_id = entity.transaction_id;
    this.is_anonymous = entity.is_anonymous;
    this.show_in_wall = entity.show_in_wall;
    this.created_at = entity.created_at;
    this.updated_at = entity.updated_at;
  }
}

export class TipValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : [];
    return super.validate(notification, new TipRules(data), newFields);
  }
}

export class TipValidatorFactory {
  static create(): TipValidator {
    return new TipValidator();
  }
}
