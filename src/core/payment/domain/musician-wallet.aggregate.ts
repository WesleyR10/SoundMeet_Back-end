import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { MusicianWalletFakeBuilder } from "./musician-wallet-fake.builder";
import { MusicianWalletValidatorFactory } from "./validators/musician-wallet.validator";
import { PixKey } from "./value-objects/pix-key.vo";

export type MusicianWalletConstructorProps = {
  wallet_id?: MusicianWalletId;
  musician_id: Uuid;
  balance: Money;
  total_earned: Money;
  total_withdrawn: Money;
  pix_key?: PixKey | null;
  bank_account?: any | null; // Placeholder for BankAccount VO if needed
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export class MusicianWalletId extends Uuid {}

export class MusicianWallet extends AggregateRoot {
  wallet_id: MusicianWalletId;
  musician_id: Uuid;
  balance: Money;
  total_earned: Money;
  total_withdrawn: Money;
  pix_key: PixKey | null;
  bank_account: any | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: MusicianWalletConstructorProps) {
    super();
    this.wallet_id = props.wallet_id ?? new MusicianWalletId();
    this.musician_id = props.musician_id;
    this.balance = props.balance;
    this.total_earned = props.total_earned;
    this.total_withdrawn = props.total_withdrawn;
    this.pix_key = props.pix_key ?? null;
    this.bank_account = props.bank_account ?? null;
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): MusicianWalletId {
    return this.wallet_id;
  }

  get value(): number {
    return this.balance.amount;
  }

  static create(command: { musician_id: string }): MusicianWallet {
    const wallet = new MusicianWallet({
      musician_id: new Uuid(command.musician_id),
      balance: new Money(0),
      total_earned: new Money(0),
      total_withdrawn: new Money(0),
    });
    wallet.validate();
    return wallet;
  }

  validate(fields?: string[]): boolean {
    const validator = MusicianWalletValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return MusicianWalletFakeBuilder;
  }

  updatePixKey(pixKey: string, type: string): void {
    this.pix_key = new PixKey(pixKey, type as any);
    this.updated_at = new Date();
    this.validate(["pix_key"]);
  }

  receiveFunds(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }
    const amountMoney = new Money(amount);
    this.balance = this.balance.add(amountMoney);
    this.total_earned = this.total_earned.add(amountMoney);
    this.updated_at = new Date();
  }

  withdrawFunds(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }
    const amountMoney = new Money(amount);
    if (this.balance.isLessThan(amountMoney)) {
      this.notification.addError("Insufficient funds", "balance");
      return;
    }
    this.balance = this.balance.subtract(amountMoney);
    this.total_withdrawn = this.total_withdrawn.add(amountMoney);
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      wallet_id: this.wallet_id.id,
      musician_id: this.musician_id.id,
      balance: this.balance.amount,
      total_earned: this.total_earned.amount,
      total_withdrawn: this.total_withdrawn.amount,
      pix_key: this.pix_key?.key ?? null,
      bank_account: this.bank_account,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
