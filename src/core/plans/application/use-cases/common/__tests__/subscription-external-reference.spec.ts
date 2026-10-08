import { BillingCycle } from "../../../../domain/plan-tier.enum";
import {
  buildSubscriptionReference,
  isSubscriptionReference,
  parseSubscriptionReference,
} from "../subscription-external-reference";

describe("subscription-external-reference", () => {
  describe("buildSubscriptionReference / parseSubscriptionReference — round-trip", () => {
    it("constrói e reparseia uma referência de músico mensal", () => {
      const ref = {
        persona: "musician" as const,
        entity_id: "musician-uuid-1",
        plan_tier: "essential",
        billing_cycle: BillingCycle.MONTHLY,
      };

      const built = buildSubscriptionReference(ref);
      expect(built).toBe("sub:musician:musician-uuid-1:essential:monthly");
      expect(parseSubscriptionReference(built)).toEqual(ref);
    });

    it("constrói e reparseia uma referência de estabelecimento anual", () => {
      const ref = {
        persona: "establishment" as const,
        entity_id: "estab-uuid-1",
        plan_tier: "pro",
        billing_cycle: BillingCycle.ANNUAL,
      };

      const built = buildSubscriptionReference(ref);
      expect(parseSubscriptionReference(built)).toEqual(ref);
    });
  });

  describe("isSubscriptionReference", () => {
    it("true para referência de assinatura", () => {
      expect(isSubscriptionReference("sub:musician:x:essential:monthly")).toBe(
        true,
      );
    });

    it("false para referência de gorjeta (UUID cru) e valores vazios", () => {
      expect(isSubscriptionReference("tip-uuid-123")).toBe(false);
      expect(isSubscriptionReference(null)).toBe(false);
      expect(isSubscriptionReference(undefined)).toBe(false);
      expect(isSubscriptionReference("")).toBe(false);
    });
  });

  describe("parseSubscriptionReference — entradas malformadas", () => {
    it("null/undefined/vazio → null", () => {
      expect(parseSubscriptionReference(null)).toBeNull();
      expect(parseSubscriptionReference(undefined)).toBeNull();
      expect(parseSubscriptionReference("")).toBeNull();
    });

    it("sem o prefixo sub: → null", () => {
      expect(
        parseSubscriptionReference("tip:musician:x:essential:monthly"),
      ).toBeNull();
    });

    it("número de segmentos errado → null", () => {
      expect(parseSubscriptionReference("sub:musician:x:essential")).toBeNull();
      expect(
        parseSubscriptionReference("sub:musician:x:essential:monthly:extra"),
      ).toBeNull();
    });

    it("persona desconhecida → null", () => {
      expect(
        parseSubscriptionReference("sub:admin:x:essential:monthly"),
      ).toBeNull();
    });

    it("billing_cycle desconhecido → null", () => {
      expect(
        parseSubscriptionReference("sub:musician:x:essential:weekly"),
      ).toBeNull();
    });

    it("entity_id ou plan_tier vazio → null", () => {
      expect(
        parseSubscriptionReference("sub:musician::essential:monthly"),
      ).toBeNull();
      expect(parseSubscriptionReference("sub:musician:x::monthly")).toBeNull();
    });
  });
});
