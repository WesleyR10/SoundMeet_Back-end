import {
  BillingCycle,
  SubscriptionPersona,
} from "../../../domain/plan-tier.enum";

// externalReference da assinatura no gateway: "sub:<persona>:<entity_id>:<tier>:<cycle>".
// O prefixo "sub:" distingue pagamentos de assinatura dos de gorjeta no webhook
// (gorjeta usa o UUID do tip cru como externalReference).
const PREFIX = "sub";

export type SubscriptionReference = {
  persona: SubscriptionPersona;
  entity_id: string;
  plan_tier: string;
  billing_cycle: BillingCycle;
};

export function buildSubscriptionReference(ref: SubscriptionReference): string {
  return [
    PREFIX,
    ref.persona,
    ref.entity_id,
    ref.plan_tier,
    ref.billing_cycle,
  ].join(":");
}

export function isSubscriptionReference(
  value: string | null | undefined,
): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

export function parseSubscriptionReference(
  value: string | null | undefined,
): SubscriptionReference | null {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== PREFIX) return null;

  const [, persona, entity_id, plan_tier, billing_cycle] = parts;
  if (persona !== "musician" && persona !== "establishment") return null;
  if (!entity_id || !plan_tier) return null;
  if (
    billing_cycle !== BillingCycle.MONTHLY &&
    billing_cycle !== BillingCycle.ANNUAL
  ) {
    return null;
  }

  return {
    persona,
    entity_id,
    plan_tier,
    billing_cycle,
  };
}
