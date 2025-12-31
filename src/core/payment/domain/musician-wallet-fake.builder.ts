import { Chance } from "chance";

import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { MusicianWallet } from "./musician-wallet.entity";
import { PixKey } from "./value-objects/pix-key.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class MusicianWalletFakeBuilder<TBuild = any> {
  // Auto generated properties
  private _wallet_id: PropOrFactory<Uuid> | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid> | undefined = undefined;
  private _balance: PropOrFactory<Money> | undefined = undefined;
  private _total_earned: PropOrFactory<Money> | undefined = undefined;
  private _total_withdrawn: PropOrFactory<Money> | undefined = undefined;
  private _pix_key: PropOrFactory<PixKey | null> | undefined = undefined;
  private _bank_account: PropOrFactory<any | null> | undefined = undefined;
  private _is_active: PropOrFactory<boolean> | undefined = undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static aMusicianWallet() {
    return new MusicianWalletFakeBuilder<MusicianWallet>();
  }

  static theMusicianWallets(countObjs: number) {
    return new MusicianWalletFakeBuilder<MusicianWallet[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withWalletId(valueOrFactory: PropOrFactory<Uuid>) {
    this._wallet_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withBalance(valueOrFactory: PropOrFactory<Money>) {
    this._balance = valueOrFactory;
    return this;
  }

  withTotalEarned(valueOrFactory: PropOrFactory<Money>) {
    this._total_earned = valueOrFactory;
    return this;
  }

  withTotalWithdrawn(valueOrFactory: PropOrFactory<Money>) {
    this._total_withdrawn = valueOrFactory;
    return this;
  }

  withPixKey(valueOrFactory: PropOrFactory<PixKey | null>) {
    this._pix_key = valueOrFactory;
    return this;
  }

  withBankAccount(valueOrFactory: PropOrFactory<any | null>) {
    this._bank_account = valueOrFactory;
    return this;
  }

  withIsActive(valueOrFactory: PropOrFactory<boolean>) {
    this._is_active = valueOrFactory;
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
    const wallets = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const wallet = new MusicianWallet({
          wallet_id: this.callFactory(this._wallet_id, index) ?? new Uuid(),
          musician_id: this.callFactory(this._musician_id, index) ?? new Uuid(),
          balance: this.callFactory(this._balance, index) ?? new Money(0),
          total_earned:
            this.callFactory(this._total_earned, index) ?? new Money(0),
          total_withdrawn:
            this.callFactory(this._total_withdrawn, index) ?? new Money(0),
          pix_key: this.callFactory(this._pix_key, index) ?? null,
          bank_account: this.callFactory(this._bank_account, index) ?? null,
          is_active: this.callFactory(this._is_active, index) ?? true,
          created_at: this.callFactory(this._created_at, index) ?? new Date(),
          updated_at: this.callFactory(this._updated_at, index) ?? new Date(),
        });
        return wallet;
      });
    return this.countObjs === 1 ? (wallets[0] as any) : (wallets as any);
  }

  get wallet_id() {
    return this.getValue("wallet_id");
  }

  get musician_id() {
    return this.getValue("musician_id");
  }

  get balance() {
    return this.getValue("balance");
  }

  get total_earned() {
    return this.getValue("total_earned");
  }

  get total_withdrawn() {
    return this.getValue("total_withdrawn");
  }

  get pix_key() {
    return this.getValue("pix_key");
  }

  get bank_account() {
    return this.getValue("bank_account");
  }

  get is_active() {
    return this.getValue("is_active");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  get updated_at() {
    return this.getValue("updated_at");
  }

  private getValue(prop: any) {
    const optional = ["wallet_id", "created_at", "updated_at"];
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
