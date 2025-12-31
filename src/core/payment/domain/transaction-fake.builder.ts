import { Chance } from "chance";

import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { PaymentMethod } from "./tip-enums";
import { Transaction } from "./transaction.entity";
import { TransactionStatus, TransactionType } from "./transaction-enums";

type PropOrFactory<T> = T | ((index: number) => T);

export class TransactionFakeBuilder<TBuild = any> {
  // Auto generated properties
  private _transaction_id: PropOrFactory<Uuid> | undefined = undefined;
  private _user_id: PropOrFactory<Uuid | null> | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid | null> | undefined = undefined;
  private _type: PropOrFactory<TransactionType> | undefined = undefined;
  private _amount: PropOrFactory<Money> | undefined = undefined;
  private _fee: PropOrFactory<Money> | undefined = undefined;
  private _net_amount: PropOrFactory<Money> | undefined = undefined;
  private _status: PropOrFactory<TransactionStatus> | undefined = undefined;
  private _payment_method: PropOrFactory<PaymentMethod> | undefined = undefined;
  private _metadata: PropOrFactory<Record<string, any> | null> | undefined =
    undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static aTransaction() {
    return new TransactionFakeBuilder<Transaction>();
  }

  static theTransactions(countObjs: number) {
    return new TransactionFakeBuilder<Transaction[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withTransactionId(valueOrFactory: PropOrFactory<Uuid>) {
    this._transaction_id = valueOrFactory;
    return this;
  }

  withUserId(valueOrFactory: PropOrFactory<Uuid | null>) {
    this._user_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid | null>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withType(valueOrFactory: PropOrFactory<TransactionType>) {
    this._type = valueOrFactory;
    return this;
  }

  withAmount(valueOrFactory: PropOrFactory<Money>) {
    this._amount = valueOrFactory;
    return this;
  }

  withFee(valueOrFactory: PropOrFactory<Money>) {
    this._fee = valueOrFactory;
    return this;
  }

  withNetAmount(valueOrFactory: PropOrFactory<Money>) {
    this._net_amount = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<TransactionStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  withPaymentMethod(valueOrFactory: PropOrFactory<PaymentMethod>) {
    this._payment_method = valueOrFactory;
    return this;
  }

  withMetadata(valueOrFactory: PropOrFactory<Record<string, any> | null>) {
    this._metadata = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withUpdatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._updated_at = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const transactions = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const transaction = new Transaction({
          transaction_id:
            this.callFactory(this._transaction_id, index) ?? new Uuid(),
          user_id: this.callFactory(this._user_id, index) ?? new Uuid(),
          musician_id: this.callFactory(this._musician_id, index) ?? new Uuid(),
          type: this.callFactory(this._type, index) ?? TransactionType.TIP,
          amount:
            this.callFactory(this._amount, index) ??
            new Money(this.chance.floating({ min: 1, max: 100 })),
          fee: this.callFactory(this._fee, index) ?? new Money(0),
          net_amount:
            this.callFactory(this._net_amount, index) ??
            new Money(this.chance.floating({ min: 1, max: 100 })),
          status:
            this.callFactory(this._status, index) ?? TransactionStatus.PENDING,
          payment_method:
            this.callFactory(this._payment_method, index) ?? PaymentMethod.PIX,
          metadata: this.callFactory(this._metadata, index) ?? null,
          created_at: this.callFactory(this._created_at, index) ?? new Date(),
          updated_at: this.callFactory(this._updated_at, index) ?? new Date(),
        });
        return transaction;
      });
    return this.countObjs === 1
      ? (transactions[0] as any)
      : (transactions as any);
  }

  get transaction_id() {
    return this.getValue("transaction_id");
  }

  get user_id() {
    return this.getValue("user_id");
  }

  get musician_id() {
    return this.getValue("musician_id");
  }

  get type() {
    return this.getValue("type");
  }

  get amount() {
    return this.getValue("amount");
  }

  get fee() {
    return this.getValue("fee");
  }

  get net_amount() {
    return this.getValue("net_amount");
  }

  get status() {
    return this.getValue("status");
  }

  get payment_method() {
    return this.getValue("payment_method");
  }

  get metadata() {
    return this.getValue("metadata");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  get updated_at() {
    return this.getValue("updated_at");
  }

  private getValue(prop: any) {
    const optional = ["transaction_id", "created_at", "updated_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
