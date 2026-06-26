import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { BillingCycle } from "../plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../subscription.aggregate";

describe("Subscription aggregate — billing_cycle (4D.8)", () => {
  // ----------------------------------------------------------------
  // Defaults e constructor
  // ----------------------------------------------------------------
  describe("defaults", () => {
    it("billing_cycle padrão = MONTHLY quando não informado", () => {
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
      });
      expect(sub.billing_cycle).toBe(BillingCycle.MONTHLY);
    });

    it("billing_cycle ANNUAL é preservado quando informado", () => {
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "pro",
        persona: "musician",
        billing_cycle: BillingCycle.ANNUAL,
      });
      expect(sub.billing_cycle).toBe(BillingCycle.ANNUAL);
    });

    it("expires_at é null no constructor (sem auto-cálculo)", () => {
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
      });
      expect(sub.expires_at).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // static create() — auto-cálculo de expires_at
  // ----------------------------------------------------------------
  describe("create() — expires_at automático", () => {
    it("MONTHLY: expires_at ≈ agora + 1 mês", () => {
      const before = new Date();
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
      });
      const after = new Date();

      const expectedMin = new Date(before);
      expectedMin.setMonth(expectedMin.getMonth() + 1);
      const expectedMax = new Date(after);
      expectedMax.setMonth(expectedMax.getMonth() + 1);

      expect(sub.expires_at).not.toBeNull();
      expect(sub.expires_at!.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime(),
      );
      expect(sub.expires_at!.getTime()).toBeLessThanOrEqual(
        expectedMax.getTime(),
      );
    });

    it("ANNUAL: expires_at ≈ agora + 1 ano", () => {
      const before = new Date();
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "pro",
        persona: "musician",
        billing_cycle: BillingCycle.ANNUAL,
      });
      const after = new Date();

      const expectedMin = new Date(before);
      expectedMin.setFullYear(expectedMin.getFullYear() + 1);
      const expectedMax = new Date(after);
      expectedMax.setFullYear(expectedMax.getFullYear() + 1);

      expect(sub.expires_at).not.toBeNull();
      expect(sub.expires_at!.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime(),
      );
      expect(sub.expires_at!.getTime()).toBeLessThanOrEqual(
        expectedMax.getTime(),
      );
    });

    it("create() sem billing_cycle → MONTHLY por padrão", () => {
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "free",
        persona: "musician",
      });
      expect(sub.billing_cycle).toBe(BillingCycle.MONTHLY);
      expect(sub.expires_at).not.toBeNull();
    });

    it("create() com trial → expires_at = null (trial usa trial_ends_at)", () => {
      const trial_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const sub = Subscription.create({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
        trial_ends_at,
      });
      expect(sub.status).toBe(SubscriptionStatus.TRIAL);
      expect(sub.expires_at).toBeNull();
      expect(sub.trial_ends_at).toEqual(trial_ends_at);
    });
  });

  // ----------------------------------------------------------------
  // isActive() com expires_at
  // ----------------------------------------------------------------
  describe("isActive() — respeita expires_at", () => {
    it("ACTIVE + expires_at no futuro → ativo", () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
        expires_at: future,
      });
      expect(sub.isActive()).toBe(true);
    });

    it("ACTIVE + expires_at no passado → inativo (vencida antes do cron)", () => {
      const past = new Date(Date.now() - 1000);
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
        expires_at: past,
      });
      expect(sub.isActive()).toBe(false);
    });

    it("ACTIVE + expires_at = null → ativo (backward compat)", () => {
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
        expires_at: null,
      });
      expect(sub.isActive()).toBe(true);
    });

    it("CANCELLED → inativo independente de expires_at", () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "pro",
        persona: "musician",
        status: SubscriptionStatus.CANCELLED,
        expires_at: future,
      });
      expect(sub.isActive()).toBe(false);
    });

    it("EXPIRED → inativo", () => {
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "pro",
        persona: "musician",
        status: SubscriptionStatus.EXPIRED,
      });
      expect(sub.isActive()).toBe(false);
    });

    it("TRIAL + trial_ends_at no futuro → ativo", () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        status: SubscriptionStatus.TRIAL,
        trial_ends_at: future,
      });
      expect(sub.isActive()).toBe(true);
    });

    it("TRIAL + trial_ends_at no passado → inativo", () => {
      const past = new Date(Date.now() - 1000);
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "essential",
        persona: "musician",
        status: SubscriptionStatus.TRIAL,
        trial_ends_at: past,
      });
      expect(sub.isActive()).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // toJSON()
  // ----------------------------------------------------------------
  describe("toJSON()", () => {
    it("inclui billing_cycle", () => {
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "pro",
        persona: "musician",
        billing_cycle: BillingCycle.ANNUAL,
      });
      const json = sub.toJSON();
      expect(json.billing_cycle).toBe(BillingCycle.ANNUAL);
    });

    it("billing_cycle padrão MONTHLY aparece no JSON", () => {
      const sub = new Subscription({
        musician_id: "musician-1",
        plan_tier: "free",
        persona: "musician",
      });
      expect(sub.toJSON().billing_cycle).toBe(BillingCycle.MONTHLY);
    });
  });

  // ----------------------------------------------------------------
  // Validação
  // ----------------------------------------------------------------
  describe("validate() — billing_cycle", () => {
    it("billing_cycle inválido lança EntityValidationError", () => {
      expect(() =>
        Subscription.create({
          musician_id: "musician-1",
          plan_tier: "pro",
          persona: "musician",
          billing_cycle: "weekly" as BillingCycle,
        }),
      ).toThrow(EntityValidationError);
    });

    it("billing_cycle 'monthly' é válido", () => {
      expect(() =>
        Subscription.create({
          musician_id: "musician-1",
          plan_tier: "essential",
          persona: "musician",
          billing_cycle: BillingCycle.MONTHLY,
        }),
      ).not.toThrow();
    });

    it("billing_cycle 'annual' é válido", () => {
      expect(() =>
        Subscription.create({
          musician_id: "musician-1",
          plan_tier: "pro",
          persona: "musician",
          billing_cycle: BillingCycle.ANNUAL,
        }),
      ).not.toThrow();
    });
  });

  // ----------------------------------------------------------------
  // fake() builder
  // ----------------------------------------------------------------
  describe("fake()", () => {
    it("aMusicianSubscription() retorna MONTHLY por padrão", () => {
      const sub = Subscription.fake().aMusicianSubscription();
      expect(sub.billing_cycle).toBe(BillingCycle.MONTHLY);
      expect(sub.persona).toBe("musician");
    });
  });
});
