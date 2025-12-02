import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Money } from "../../shared/domain/value-objects/money.vo";
import { PixKey } from "./value-objects/pix-key.vo";
import { TipValidatorFactory } from "./validators/tip.validator";
import { PaymentMethod, TipStatus } from "./tip-enums";
import { TipCompletedEvent } from "./events/tip-completed.event";
import { TipFailedEvent } from "./events/tip-failed.event";
import { TipFakeBuilder } from "./tip-fake.builder";

// Re-exporting for convenience, but implementation is now in tip-enums.ts
export { PaymentMethod, TipStatus };

export type TipConstructorProps = {
  tip_id?: Uuid;
  audience_id: Uuid;
  musician_id?: Uuid | null;
  band_id?: Uuid | null;
  event_id?: Uuid | null;
  amount: Money;
  message?: string | null;
  payment_method: PaymentMethod;
  status?: TipStatus;
  transaction_id?: string | null;
  pix_key?: PixKey | null;
  is_anonymous?: boolean;
  show_in_wall?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type TipCreateCommand = {
  audience_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  amount: number;
  message?: string | null;
  payment_method: PaymentMethod;
  pix_key?: { key: string; type: string } | null;
  is_anonymous?: boolean;
  show_in_wall?: boolean;
};

export class Tip extends AggregateRoot {
  tip_id: Uuid;
  audience_id: Uuid;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  event_id: Uuid | null;
  amount: Money;
  message: string | null;
  payment_method: PaymentMethod;
  status: TipStatus;
  transaction_id: string | null;
  pix_key: PixKey | null;
  is_anonymous: boolean;
  show_in_wall: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: TipConstructorProps) {
    super();
    this.tip_id = props.tip_id ?? new Uuid();
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id ?? null;
    this.band_id = props.band_id ?? null;
    this.event_id = props.event_id ?? null;
    this.amount = props.amount;
    this.message = props.message ?? null;
    this.payment_method = props.payment_method;
    this.status = props.status ?? TipStatus.PENDING;
    this.transaction_id = props.transaction_id ?? null;
    this.pix_key = props.pix_key ?? null;
    this.is_anonymous = props.is_anonymous ?? false;
    this.show_in_wall = props.show_in_wall ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): Uuid {
    return this.tip_id;
  }

  static create(command: TipCreateCommand): Tip {
    if (!command.musician_id && !command.band_id) {
      throw new Error("Either musician_id or band_id must be provided");
    }

    const tip = new Tip({
      audience_id: new Uuid(command.audience_id),
      musician_id: command.musician_id ? new Uuid(command.musician_id) : null,
      band_id: command.band_id ? new Uuid(command.band_id) : null,
      event_id: command.event_id ? new Uuid(command.event_id) : null,
      amount: new Money(command.amount),
      message: command.message,
      payment_method: command.payment_method,
      pix_key: command.pix_key
        ? PixKey.create(command.pix_key.key, command.pix_key.type as any)
        : null,
      is_anonymous: command.is_anonymous,
      show_in_wall: command.show_in_wall,
    });

    tip.validate();
    return tip;
  }

  validate(fields?: string[]): boolean {
    const validator = TipValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return TipFakeBuilder;
  }

  complete(transactionId: string): void {
    this.status = TipStatus.COMPLETED;
    this.transaction_id = transactionId;
    this.updated_at = new Date();
    this.validate();
    this.applyEvent(
      new TipCompletedEvent(
        this.tip_id,
        this.amount,
        this.musician_id,
        this.audience_id,
        this.band_id
      ),
    );
  }

  fail(): void {
    this.status = TipStatus.FAILED;
    this.updated_at = new Date();
    this.validate();
    this.applyEvent(new TipFailedEvent(this.tip_id, this.musician_id, this.audience_id, null, this.band_id));
  }

  toJSON() {
    return {
      tip_id: this.tip_id.id,
      audience_id: this.audience_id.id,
      musician_id: this.musician_id?.id || null,
      band_id: this.band_id?.id || null,
      event_id: this.event_id?.id || null,
      amount: this.amount.amount,
      message: this.message,
      payment_method: this.payment_method,
      status: this.status,
      transaction_id: this.transaction_id,
      pix_key: this.pix_key?.key || null,
      is_anonymous: this.is_anonymous,
      show_in_wall: this.show_in_wall,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
