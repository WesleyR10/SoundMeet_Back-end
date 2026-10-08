import { Subscription } from "../../../domain/subscription.aggregate";

export type SubscriptionOutput = {
  subscription_id: string;
  musician_id: string | null;
  establishment_id: string | null;
  plan_tier: string;
  persona: string;
  billing_cycle: string;
  status: string;
  started_at: Date;
  expires_at: Date | null;
  trial_ends_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
};

export class SubscriptionOutputMapper {
  // gateway_customer_id/gateway_subscription_id ficam de fora de propósito —
  // são detalhe de integração, não pertencem à resposta HTTP.
  static toOutput(entity: Subscription): SubscriptionOutput {
    const json = entity.toJSON();
    return {
      subscription_id: json.subscription_id,
      musician_id: json.musician_id,
      establishment_id: json.establishment_id,
      plan_tier: json.plan_tier,
      persona: json.persona,
      billing_cycle: json.billing_cycle,
      status: json.status,
      started_at: json.started_at,
      expires_at: json.expires_at,
      trial_ends_at: json.trial_ends_at,
      cancelled_at: json.cancelled_at,
      created_at: json.created_at,
    };
  }
}
