import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BillingCycle } from "../../../../domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../infra/db/in-memory/subscription-in-memory.repository";
import { FakeSubscriptionBillingGateway } from "../../../../infra/gateways/fake-subscription-billing.gateway";
import { CancelSubscriptionUseCase } from "../cancel-subscription.use-case";

describe("CancelSubscriptionUseCase Unit Tests", () => {
  let useCase: CancelSubscriptionUseCase;
  let repo: SubscriptionInMemoryRepository;
  let gateway: FakeSubscriptionBillingGateway;

  beforeEach(() => {
    repo = new SubscriptionInMemoryRepository();
    gateway = new FakeSubscriptionBillingGateway();
    useCase = new CancelSubscriptionUseCase(repo, gateway);
  });

  it("cancela a assinatura ativa do músico e cancela no gateway", async () => {
    const musician_id = new Uuid().id;
    await repo.insert(
      Subscription.create({
        musician_id,
        persona: "musician",
        plan_tier: "essential",
        billing_cycle: BillingCycle.MONTHLY,
        gateway_subscription_id: "asaas_sub_1",
      }),
    );

    const output = await useCase.execute({
      persona: "musician",
      entity_id: musician_id,
    });

    expect(output.status).toBe(SubscriptionStatus.CANCELLED);
    expect(gateway.cancelled).toContain("asaas_sub_1");
  });

  it("lança NotFoundError quando não há assinatura ativa", async () => {
    await expect(() =>
      useCase.execute({ persona: "musician", entity_id: new Uuid().id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("cancela localmente mesmo se a assinatura não tiver gateway_subscription_id", async () => {
    const establishment_id = new Uuid().id;
    await repo.insert(
      Subscription.create({
        establishment_id,
        persona: "establishment",
        plan_tier: "growth",
        billing_cycle: BillingCycle.MONTHLY,
      }),
    );

    const output = await useCase.execute({
      persona: "establishment",
      entity_id: establishment_id,
    });

    expect(output.status).toBe(SubscriptionStatus.CANCELLED);
    expect(gateway.cancelled).toHaveLength(0);
  });

  it("falha do gateway ao cancelar não impede o cancelamento local (best-effort)", async () => {
    const musician_id = new Uuid().id;
    await repo.insert(
      Subscription.create({
        musician_id,
        persona: "musician",
        plan_tier: "essential",
        billing_cycle: BillingCycle.MONTHLY,
        gateway_subscription_id: "asaas_sub_1",
      }),
    );
    jest
      .spyOn(gateway, "cancelSubscription")
      .mockRejectedValueOnce(new Error("gateway indisponível"));

    const output = await useCase.execute({
      persona: "musician",
      entity_id: musician_id,
    });

    expect(output.status).toBe(SubscriptionStatus.CANCELLED);
  });
});
