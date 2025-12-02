import { Chance } from "chance";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Money } from "../../shared/domain/value-objects/money.vo";
import { PixKey, PixKeyType } from "./value-objects/pix-key.vo";
import { Tip, TipStatus, PaymentMethod } from "./tip.entity";

type PropOrFactory<T> = T | ((index: number) => T);

export class TipFakeBuilder<TBuild = any> {
  // Auto generated properties
  private _tip_id: PropOrFactory<Uuid> | undefined = undefined;
  private _audience_id: PropOrFactory<Uuid> | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid> | undefined = undefined;
  private _event_id: PropOrFactory<Uuid | null> | undefined = undefined;
  private _amount: PropOrFactory<Money> | undefined = undefined;
  private _message: PropOrFactory<string | null> | undefined = undefined;
  private _payment_method: PropOrFactory<PaymentMethod> | undefined = undefined;
  private _status: PropOrFactory<TipStatus> | undefined = undefined;
  private _transaction_id: PropOrFactory<string | null> | undefined = undefined;
  private _pix_key: PropOrFactory<PixKey | null> | undefined = undefined;
  private _is_anonymous: PropOrFactory<boolean> | undefined = undefined;
  private _show_in_wall: PropOrFactory<boolean> | undefined = undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static aTip() {
    return new TipFakeBuilder<Tip>();
  }

  static theTips(countObjs: number) {
    return new TipFakeBuilder<Tip[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withTipId(valueOrFactory: PropOrFactory<Uuid>) {
    this._tip_id = valueOrFactory;
    return this;
  }

  withAudienceId(valueOrFactory: PropOrFactory<Uuid>) {
    this._audience_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withEventId(valueOrFactory: PropOrFactory<Uuid | null>) {
    this._event_id = valueOrFactory;
    return this;
  }

  withAmount(valueOrFactory: PropOrFactory<Money>) {
    this._amount = valueOrFactory;
    return this;
  }

  withMessage(valueOrFactory: PropOrFactory<string | null>) {
    this._message = valueOrFactory;
    return this;
  }

  withPaymentMethod(valueOrFactory: PropOrFactory<PaymentMethod>) {
    this._payment_method = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<TipStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  withTransactionId(valueOrFactory: PropOrFactory<string | null>) {
    this._transaction_id = valueOrFactory;
    return this;
  }

  withPixKey(valueOrFactory: PropOrFactory<PixKey | null>) {
    this._pix_key = valueOrFactory;
    return this;
  }

  withIsAnonymous(valueOrFactory: PropOrFactory<boolean>) {
    this._is_anonymous = valueOrFactory;
    return this;
  }

  withShowInWall(valueOrFactory: PropOrFactory<boolean>) {
    this._show_in_wall = valueOrFactory;
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
    const tips = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const tip = new Tip({
        tip_id: this.callFactory(this._tip_id, index) ?? new Uuid(),
        audience_id: this.callFactory(this._audience_id, index) ?? new Uuid(),
        musician_id: this.callFactory(this._musician_id, index) ?? new Uuid(),
        event_id: this.callFactory(this._event_id, index) ?? null,
        amount: this.callFactory(this._amount, index) ?? new Money(this.chance.floating({ min: 1, max: 100 })),
        message: this.callFactory(this._message, index) ?? this.chance.sentence(),
        payment_method: this.callFactory(this._payment_method, index) ?? PaymentMethod.PIX,
        status: this.callFactory(this._status, index) ?? TipStatus.PENDING,
        transaction_id: this.callFactory(this._transaction_id, index) ?? null,
        pix_key: this.callFactory(this._pix_key, index) ?? null,
        is_anonymous: this.callFactory(this._is_anonymous, index) ?? false,
        show_in_wall: this.callFactory(this._show_in_wall, index) ?? true,
        created_at: this.callFactory(this._created_at, index) ?? new Date(),
        updated_at: this.callFactory(this._updated_at, index) ?? new Date(),
      });
      return tip;
    });
    return this.countObjs === 1 ? (tips[0] as any) : (tips as any);
  }

  get tip_id() {
    return this.getValue("tip_id");
  }

  get audience_id() {
    return this.getValue("audience_id");
  }

  get musician_id() {
    return this.getValue("musician_id");
  }

  get event_id() {
    return this.getValue("event_id");
  }

  get amount() {
    return this.getValue("amount");
  }

  get message() {
    return this.getValue("message");
  }

  get payment_method() {
    return this.getValue("payment_method");
  }

  get status() {
    return this.getValue("status");
  }

  get transaction_id() {
    return this.getValue("transaction_id");
  }

  get pix_key() {
    return this.getValue("pix_key");
  }

  get is_anonymous() {
    return this.getValue("is_anonymous");
  }

  get show_in_wall() {
    return this.getValue("show_in_wall");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  get updated_at() {
    return this.getValue("updated_at");
  }

  private getValue(prop: any) {
    const optional = ["tip_id", "created_at", "updated_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(`Property ${prop} not have a factory, use 'with' methods`);
    }
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
