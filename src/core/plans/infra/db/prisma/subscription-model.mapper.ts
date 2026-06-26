import { SubscriptionStatus as PrismaSubscriptionStatus } from "@prisma/client";

import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  Subscription,
  SubscriptionId,
  SubscriptionStatus,
} from "../../../domain/subscription.aggregate";
import { BillingCycle, SubscriptionPersona } from "../../../domain/plan-tier.enum";

export type SubscriptionModel = {
  id: string;
  musician_id: string | null;
  establishment_id: string | null;
  plan_tier: string;
  persona: string;
  billing_cycle: string;
  status: PrismaSubscriptionStatus;
  started_at: Date;
  expires_at: Date | null;
  trial_ends_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class SubscriptionModelMapper {
  static toEntity(model: SubscriptionModel): Subscription {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      cancelled: SubscriptionStatus.CANCELLED,
      expired: SubscriptionStatus.EXPIRED,
      trial: SubscriptionStatus.TRIAL,
    };

    const billingCycleMap: Record<string, BillingCycle> = {
      monthly: BillingCycle.MONTHLY,
      annual: BillingCycle.ANNUAL,
    };

    const status = statusMap[model.status];
    if (!status) {
      throw new LoadEntityError([
        { subscription: [`Status inválido: ${model.status}`] },
      ]);
    }

    return new Subscription({
      subscription_id: new SubscriptionId(model.id),
      musician_id: model.musician_id,
      establishment_id: model.establishment_id,
      plan_tier: model.plan_tier,
      persona: model.persona as SubscriptionPersona,
      billing_cycle: billingCycleMap[model.billing_cycle] ?? BillingCycle.MONTHLY,
      status,
      started_at: model.started_at,
      expires_at: model.expires_at,
      trial_ends_at: model.trial_ends_at,
      cancelled_at: model.cancelled_at,
      created_at: model.created_at,
    });
  }

  static toModel(entity: Subscription): Omit<SubscriptionModel, "updated_at"> {
    return {
      id: entity.subscription_id.id,
      musician_id: entity.musician_id,
      establishment_id: entity.establishment_id,
      plan_tier: entity.plan_tier,
      persona: entity.persona,
      billing_cycle: entity.billing_cycle,
      status: entity.status as PrismaSubscriptionStatus,
      started_at: entity.started_at,
      expires_at: entity.expires_at,
      trial_ends_at: entity.trial_ends_at,
      cancelled_at: entity.cancelled_at,
      created_at: entity.created_at,
    };
  }
}
