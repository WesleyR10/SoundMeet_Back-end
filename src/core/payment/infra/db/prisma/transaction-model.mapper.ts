import { Transaction } from "../../../domain/transaction.entity";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { PaymentMethod } from "../../../domain/tip-enums";
import { Transaction as PrismaTransaction } from "@prisma/client";
import { TransactionStatus, TransactionType } from "@core/payment/domain/transaction-enums";

export type TransactionModelProps = {
  id: string;
  userId: string | null;
  musicianId: string | null;
  type: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
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
      type: entity.type,
      amount: entity.amount.amount,
      fee: entity.fee.amount,
      netAmount: entity.net_amount.amount,
      status: entity.status,
      paymentMethod: entity.payment_method,
      externalId: null, // Not currently in domain entity, but present in Prisma schema
      metadata: entity.metadata,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: PrismaTransaction): Transaction {
    return new Transaction({
      transaction_id: new Uuid(model.id),
      user_id: model.userId ? new Uuid(model.userId) : null,
      musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
      type: model.type as TransactionType,
      amount: new Money(model.amount),
      fee: new Money(model.fee),
      net_amount: new Money(model.netAmount),
      status: model.status as TransactionStatus,
      payment_method: model.paymentMethod as PaymentMethod,
      metadata: model.metadata as Record<string, any> | null,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
