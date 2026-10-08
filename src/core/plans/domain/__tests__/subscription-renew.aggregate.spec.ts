import { BillingCycle } from "../plan-tier.enum";
import { Subscription, SubscriptionStatus } from "../subscription.aggregate";

describe("Subscription aggregate — renew() e vínculo com gateway (checkout Asaas)", () => {
  describe("gateway_customer_id / gateway_subscription_id", () => {
    it("são null por padrão", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
      });
      expect(sub.gateway_customer_id).toBeNull();
      expect(sub.gateway_subscription_id).toBeNull();
    });

    it("create() aceita e preserva os dois campos", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        gateway_customer_id: "cus_123",
        gateway_subscription_id: "sub_123",
      });
      expect(sub.gateway_customer_id).toBe("cus_123");
      expect(sub.gateway_subscription_id).toBe("sub_123");
    });

    it("toJSON() inclui os dois campos", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        gateway_customer_id: "cus_123",
        gateway_subscription_id: "sub_123",
      });
      expect(sub.toJSON()).toMatchObject({
        gateway_customer_id: "cus_123",
        gateway_subscription_id: "sub_123",
      });
    });
  });

  describe("renew()", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");

    it("reativa uma assinatura EXPIRED e empurra expires_at um ciclo à frente de `now`", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
      });
      sub.expire();
      expect(sub.status).toBe(SubscriptionStatus.EXPIRED);

      sub.renew(now);

      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      const expected = new Date(now);
      expected.setMonth(expected.getMonth() + 1);
      expect(sub.expires_at).toEqual(expected);
    });

    it("sai do TRIAL: limpa trial_ends_at e vira ACTIVE com expires_at calculado", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
        trial_ends_at: new Date("2026-08-15"),
      });
      expect(sub.status).toBe(SubscriptionStatus.TRIAL);

      sub.renew(now);

      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.trial_ends_at).toBeNull();
    });

    it("respeita o billing_cycle ANNUAL ao calcular a nova expiração", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "pro",
        persona: "musician",
        billing_cycle: BillingCycle.ANNUAL,
      });

      sub.renew(now);

      const expected = new Date(now);
      expected.setFullYear(expected.getFullYear() + 1);
      expect(sub.expires_at).toEqual(expected);
    });

    it("assinatura CANCELLED não renova — pagamento residual atrasado não reativa cobrança cancelada pelo usuário", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
      });
      const expiresBeforeCancel = sub.expires_at;
      sub.cancel();

      sub.renew(now);

      expect(sub.status).toBe(SubscriptionStatus.CANCELLED);
      expect(sub.expires_at).toEqual(expiresBeforeCancel);
    });

    it("chamadas sucessivas de renew() empurram a expiração a cada vez (renovação mensal recorrente)", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
      });

      sub.renew(now);
      const afterFirst = sub.expires_at;

      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      sub.renew(oneMonthLater);
      const afterSecond = sub.expires_at;

      expect(afterSecond!.getTime()).toBeGreaterThan(afterFirst!.getTime());
    });

    it("default now = Date.now() quando omitido", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
      });

      const before = new Date();
      sub.renew();
      const after = new Date();

      const expectedMin = new Date(before);
      expectedMin.setMonth(expectedMin.getMonth() + 1);
      const expectedMax = new Date(after);
      expectedMax.setMonth(expectedMax.getMonth() + 1);

      expect(sub.expires_at!.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime(),
      );
      expect(sub.expires_at!.getTime()).toBeLessThanOrEqual(
        expectedMax.getTime(),
      );
    });
  });
});
