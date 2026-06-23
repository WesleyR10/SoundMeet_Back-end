import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { TransactionCreatedEvent } from "./events/transaction-created.event";
import { PaymentMethod } from "./tip-enums";
import { TransactionStatus, TransactionType } from "./transaction-enums";
import { TransactionFakeBuilder } from "./transaction-fake.builder";
import { TransactionValidatorFactory } from "./validators/transaction.validator";

export type TransactionConstructorProps = {
  transaction_id?: TransactionId;
  user_id?: Uuid | null;
  musician_id?: Uuid | null;
  band_id?: Uuid | null;
  type: TransactionType;
  amount: Money;
  fee: Money;
  net_amount: Money;
  status?: TransactionStatus;
  payment_method: PaymentMethod;
  external_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: Date;
  updated_at?: Date;
};

export type TransactionCreateCommand = {
  user_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  type: TransactionType;
  amount: number;
  fee?: number;
  payment_method: PaymentMethod;
  metadata?: Record<string, any> | null;
};

export class TransactionId extends Uuid {}

export class Transaction extends AggregateRoot {
  transaction_id: TransactionId;
  user_id: Uuid | null;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  type: TransactionType;
  amount: Money;
  fee: Money;
  net_amount: Money;
  status: TransactionStatus;
  payment_method: PaymentMethod;
  external_id: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: TransactionConstructorProps) {
    super();
    this.transaction_id = props.transaction_id ?? new TransactionId();
    this.user_id = props.user_id ?? null;
    this.musician_id = props.musician_id ?? null;
    this.band_id = props.band_id ?? null;
    this.type = props.type;
    this.amount = props.amount;
    this.fee = props.fee;
    this.net_amount = props.net_amount;
    this.status = props.status ?? TransactionStatus.PENDING;
    this.payment_method = props.payment_method;
    this.external_id = props.external_id ?? null;
    this.metadata = props.metadata ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): TransactionId {
    return this.transaction_id;
  }

  static create(command: TransactionCreateCommand): Transaction {
    const amount = new Money(command.amount);
    const fee = new Money(command.fee ?? 0);
    const net_amount = new Money(command.amount - (command.fee ?? 0));

    const transaction = new Transaction({
      user_id: command.user_id ? new Uuid(command.user_id) : null,
      musician_id: command.musician_id ? new Uuid(command.musician_id) : null,
      band_id: command.band_id ? new Uuid(command.band_id) : null,
      type: command.type,
      amount,
      fee,
      net_amount,
      payment_method: command.payment_method,
      metadata: command.metadata,
    });

    transaction.validate();
    transaction.applyEvent(
      new TransactionCreatedEvent(
        transaction.transaction_id,
        transaction.type,
        transaction.amount,
        transaction.fee,
        transaction.net_amount,
        transaction.musician_id,
        transaction.user_id,
      ),
    );
    return transaction;
  }

  validate(fields?: string[]): boolean {
    const validator = TransactionValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return TransactionFakeBuilder;
  }

  complete(): void {
    this.status = TransactionStatus.COMPLETED;
    this.updated_at = new Date();
  }

  fail(): void {
    this.status = TransactionStatus.FAILED;
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      transaction_id: this.transaction_id.id,
      user_id: this.user_id?.id ?? null,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      type: this.type,
      amount: this.amount.amount,
      fee: this.fee.amount,
      net_amount: this.net_amount.amount,
      status: this.status,
      payment_method: this.payment_method,
      external_id: this.external_id,
      metadata: this.metadata,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
