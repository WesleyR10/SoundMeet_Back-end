import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BillingCycle } from "../../../../domain/plan-tier.enum";
import { Subscription } from "../../../../domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../infra/db/in-memory/subscription-in-memory.repository";
import { GetActiveSubscriptionUseCase } from "../get-active-subscription.use-case";

describe("GetActiveSubscriptionUseCase Unit Tests", () => {
  let useCase: GetActiveSubscriptionUseCase;
  let repo: SubscriptionInMemoryRepository;

  beforeEach(() => {
    repo = new SubscriptionInMemoryRepository();
    useCase = new GetActiveSubscriptionUseCase(repo);
  });

  it("retorna effective_tier=free e subscription=null quando não há assinatura", async () => {
    const output = await useCase.execute({
      persona: "musician",
      entity_id: new Uuid().id,
    });

    expect(output.effective_tier).toBe("free");
    expect(output.subscription).toBeNull();
  });

  it("retorna o tier e os dados da assinatura ativa do músico", async () => {
    const musician_id = new Uuid().id;
    await repo.insert(
      Subscription.create({
        musician_id,
        persona: "musician",
        plan_tier: "essential",
        billing_cycle: BillingCycle.MONTHLY,
      }),
    );

    const output = await useCase.execute({
      persona: "musician",
      entity_id: musician_id,
    });

    expect(output.effective_tier).toBe("essential");
    expect(output.subscription?.plan_tier).toBe("essential");
    expect(output.subscription?.status).toBe("active");
  });

  it("assinatura cancelada não conta como ativa — effective_tier volta a free", async () => {
    const musician_id = new Uuid().id;
    const sub = Subscription.create({
      musician_id,
      persona: "musician",
      plan_tier: "pro",
      billing_cycle: BillingCycle.MONTHLY,
    });
    sub.cancel();
    await repo.insert(sub);

    const output = await useCase.execute({
      persona: "musician",
      entity_id: musician_id,
    });

    expect(output.effective_tier).toBe("free");
  });

  it("resolve a persona de estabelecimento com o tier correspondente", async () => {
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

    expect(output.effective_tier).toBe("growth");
  });

  it("lança InvalidArgumentError quando entity_id está vazio", async () => {
    await expect(() =>
      useCase.execute({ persona: "musician", entity_id: "" }),
    ).rejects.toThrow(InvalidArgumentError);
  });
});
