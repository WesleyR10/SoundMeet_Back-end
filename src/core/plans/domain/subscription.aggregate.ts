import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { BillingCycle, SubscriptionPersona } from "./plan-tier.enum";
import { SubscriptionValidatorFactory } from "./subscription.validator";

export class SubscriptionId extends Uuid {}

export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
  TRIAL = "trial",
}

export type SubscriptionProps = {
  subscription_id?: SubscriptionId;
  musician_id?: string | null;
  establishment_id?: string | null;
  plan_tier: string;
  persona: SubscriptionPersona;
  billing_cycle?: BillingCycle;
  status?: SubscriptionStatus;
  started_at?: Date;
  expires_at?: Date | null;
  trial_ends_at?: Date | null;
  cancelled_at?: Date | null;
  created_at?: Date;
};

export type CreateSubscriptionCommand = {
  musician_id?: string;
  establishment_id?: string;
  plan_tier: string;
  persona: SubscriptionPersona;
  billing_cycle?: BillingCycle;
  trial_ends_at?: Date;
};

export class Subscription extends AggregateRoot {
  subscription_id: SubscriptionId;
  musician_id: string | null;
  establishment_id: string | null;
  plan_tier: string;
  persona: SubscriptionPersona;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  expires_at: Date | null;
  trial_ends_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;

  constructor(props: SubscriptionProps) {
    super();
    this.subscription_id = props.subscription_id ?? new SubscriptionId();
    this.musician_id = props.musician_id ?? null;
    this.establishment_id = props.establishment_id ?? null;
    this.plan_tier = props.plan_tier;
    this.persona = props.persona;
    this.billing_cycle = props.billing_cycle ?? BillingCycle.MONTHLY;
    this.status = props.status ?? SubscriptionStatus.ACTIVE;
    this.started_at = props.started_at ?? new Date();
    this.expires_at = props.expires_at ?? null;
    this.trial_ends_at = props.trial_ends_at ?? null;
    this.cancelled_at = props.cancelled_at ?? null;
    this.created_at = props.created_at ?? new Date();
  }

  static create(command: CreateSubscriptionCommand): Subscription {
    const billing_cycle = command.billing_cycle ?? BillingCycle.MONTHLY;
    const started_at = new Date();
    const expires_at = command.trial_ends_at
      ? null
      : Subscription.computeExpiryDate(billing_cycle, started_at);

    const sub = new Subscription({
      musician_id: command.musician_id,
      establishment_id: command.establishment_id,
      plan_tier: command.plan_tier,
      persona: command.persona,
      billing_cycle,
      started_at,
      expires_at,
      trial_ends_at: command.trial_ends_at,
      status: command.trial_ends_at
        ? SubscriptionStatus.TRIAL
        : SubscriptionStatus.ACTIVE,
    });
    sub.validate();
    if (sub.notification.hasErrors()) {
      throw new EntityValidationError(sub.notification.toJSON());
    }
    return sub;
  }

  private static computeExpiryDate(cycle: BillingCycle, from: Date): Date {
    const d = new Date(from);
    if (cycle === BillingCycle.ANNUAL) {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  }

  validate(): void {
    SubscriptionValidatorFactory.create().validate(this.notification, this, [
      "plan_tier",
      "persona",
      "billing_cycle",
    ]);
  }

  cancel(): void {
    this.status = SubscriptionStatus.CANCELLED;
    this.cancelled_at = new Date();
  }

  expire(): void {
    this.status = SubscriptionStatus.EXPIRED;
  }

  isActive(): boolean {
    if (
      this.status === SubscriptionStatus.CANCELLED ||
      this.status === SubscriptionStatus.EXPIRED
    ) {
      return false;
    }
    if (this.status === SubscriptionStatus.TRIAL) {
      return !!(this.trial_ends_at && this.trial_ends_at > new Date());
    }
    if (this.expires_at && this.expires_at <= new Date()) {
      return false;
    }
    return true;
  }

  get entity_id(): SubscriptionId {
    return this.subscription_id;
  }

  toJSON() {
    return {
      subscription_id: this.subscription_id.id,
      musician_id: this.musician_id,
      establishment_id: this.establishment_id,
      plan_tier: this.plan_tier,
      persona: this.persona,
      billing_cycle: this.billing_cycle,
      status: this.status,
      started_at: this.started_at,
      expires_at: this.expires_at,
      trial_ends_at: this.trial_ends_at,
      cancelled_at: this.cancelled_at,
      created_at: this.created_at,
    };
  }

  static fake() {
    return {
      aMusicianSubscription: () =>
        new Subscription({
          musician_id: new Uuid().id,
          plan_tier: "free",
          persona: "musician",
          billing_cycle: BillingCycle.MONTHLY,
        }),
    };
  }
}
