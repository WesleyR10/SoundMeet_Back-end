import {
  TransactionStatus,
  TransactionType,
} from "@core/payment/domain/transaction-enums";
import {
  CurrencyEnum,
  Transaction as PrismaTransaction,
  TransactionStatus as PrismaTransactionStatus,
} from "@prisma/client";

import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { PaymentMethod } from "../../../domain/tip-enums";
import {
  Transaction,
  TransactionId,
} from "../../../domain/transaction.aggregate";

export type TransactionModelProps = {
  id: string;
  userId: string | null;
  musicianId: string | null;
  bandId: string | null;
  type: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: CurrencyEnum;
  status: PrismaTransactionStatus;
  paymentMethod: string;
  externalId: string | null;
  metadata: any | null;
  created_at: Date;
  updated_at: Date;
};

export class TransactionModelMapper {
  static toModel(entity: Transaction): TransactionModelProps {
    return {
      id: entity.transaction_id.id,
      userId: entity.user_id?.id || null,
      musicianId: entity.musician_id?.id || null,
      bandId: entity.band_id?.id || null,
      type: entity.type,
      amount: entity.amount.amount,
      fee: entity.fee.amount,
      netAmount: entity.net_amount.amount,
      currency: CurrencyEnum.BRL,
      status: entity.status as PrismaTransactionStatus,
      paymentMethod: entity.payment_method,
      externalId: entity.external_id ?? null,
      metadata: entity.metadata,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: PrismaTransaction): Transaction {
    return new Transaction({
      transaction_id: new TransactionId(model.id),
      user_id: model.userId ? new Uuid(model.userId) : null,
      musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
      band_id: model.bandId ? new Uuid(model.bandId) : null,
      type: model.type as TransactionType,
      amount: new Money(Number(model.amount)),
      fee: new Money(Number(model.fee)),
      net_amount: new Money(Number(model.netAmount)),
      status: model.status as TransactionStatus,
      payment_method: model.paymentMethod as PaymentMethod,
      external_id: model.externalId ?? null,
      metadata: model.metadata as Record<string, any> | null,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
