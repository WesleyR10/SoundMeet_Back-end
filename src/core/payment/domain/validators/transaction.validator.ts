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
import { PaymentMethod } from "../tip-enums";
import { Transaction } from "../transaction.aggregate";
import { TransactionStatus, TransactionType } from "../transaction-enums";

export class TransactionRules {
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsString()
  @IsOptional()
  user_id?: string | null;

  @IsString()
  @IsOptional()
  musician_id?: string | null;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  @Min(0)
  fee: number;

  @IsNumber()
  @Min(0)
  net_amount: number;

  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsDate()
  @IsOptional()
  created_at?: Date;

  @IsDate()
  @IsOptional()
  updated_at?: Date;

  constructor(entity: Transaction) {
    this.transaction_id = entity.transaction_id.id;
    this.user_id = entity.user_id?.id;
    this.musician_id = entity.musician_id?.id;
    this.type = entity.type;
    this.amount = entity.amount.amount;
    this.fee = entity.fee.amount;
    this.net_amount = entity.net_amount.amount;
    this.status = entity.status;
    this.payment_method = entity.payment_method;
    this.created_at = entity.created_at;
    this.updated_at = entity.updated_at;
  }
}

export class TransactionValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : [];
    return super.validate(notification, new TransactionRules(data), newFields);
  }
}

export class TransactionValidatorFactory {
  static create(): TransactionValidator {
    return new TransactionValidator();
  }
}
