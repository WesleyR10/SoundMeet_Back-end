import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BillingCycle } from "../../../../domain/plan-tier.enum";
import { Subscription } from "../../../../domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../infra/db/in-memory/subscription-in-memory.repository";
import { FakeSubscriptionBillingGateway } from "../../../../infra/gateways/fake-subscription-billing.gateway";
import { SubscriptionBillingError } from "../../../ports/subscription-billing.gateway";
import { CreateSubscriptionCheckoutUseCase } from "../create-subscription-checkout.use-case";

describe("CreateSubscriptionCheckoutUseCase Unit Tests", () => {
  let useCase: CreateSubscriptionCheckoutUseCase;
  let repo: SubscriptionInMemoryRepository;
  let gateway: FakeSubscriptionBillingGateway;

  const payer = {
    name: "João da Silva",
    email: "joao@email.com",
    cpf_cnpj: "123.456.789-09",
  };

  beforeEach(() => {
    repo = new SubscriptionInMemoryRepository();
    gateway = new FakeSubscriptionBillingGateway();
    useCase = new CreateSubscriptionCheckoutUseCase(repo, gateway);
  });

  it("cria checkout mensal de músico e retorna a URL de pagamento", async () => {
    const musician_id = new Uuid().id;

    const output = await useCase.execute({
      persona: "musician",
      entity_id: musician_id,
      plan_tier: "essential",
      billing_cycle: BillingCycle.MONTHLY,
      payer,
    });

    expect(output.checkout_url).toContain("fake-checkout");
    expect(output.amount_brl).toBe(34.9);
    expect(output.plan_tier).toBe("essential");

    const sub = gateway.subscriptions.get(output.gateway_subscription_id);
    expect(sub?.external_reference).toBe(
      `sub:musician:${musician_id}:essential:monthly`,
    );
    expect(sub?.cycle).toBe(BillingCycle.MONTHLY);
  });

  it("usa o preço anual quando billing_cycle é annual", async () => {
    const output = await useCase.execute({
      persona: "musician",
      entity_id: new Uuid().id,
      plan_tier: "essential",
      billing_cycle: BillingCycle.ANNUAL,
      payer,
    });

    expect(output.amount_brl).toBe(300);
  });

  it("NÃO cria assinatura local no checkout — só após o webhook de pagamento", async () => {
    await useCase.execute({
      persona: "musician",
      entity_id: new Uuid().id,
      plan_tier: "pro",
      billing_cycle: BillingCycle.MONTHLY,
      payer,
    });

    expect(await repo.findAll()).toHaveLength(0);
  });

  it("rejeita plano free (não é assinável)", async () => {
    await expect(() =>
      useCase.execute({
        persona: "musician",
        entity_id: new Uuid().id,
        plan_tier: "free",
        billing_cycle: BillingCycle.MONTHLY,
        payer,
      }),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("rejeita tier desconhecido para a persona", async () => {
    await expect(() =>
      useCase.execute({
        persona: "establishment",
        entity_id: new Uuid().id,
        plan_tier: "essential", // tier de músico, não de estabelecimento
        billing_cycle: BillingCycle.MONTHLY,
        payer,
      }),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("409 quando já existe assinatura ativa no MESMO plano e ciclo", async () => {
    const musician_id = new Uuid().id;
    await repo.insert(
      Subscription.create({
        musician_id,
        persona: "musician",
        plan_tier: "essential",
        billing_cycle: BillingCycle.MONTHLY,
      }),
    );

    await expect(() =>
      useCase.execute({
        persona: "musician",
        entity_id: musician_id,
        plan_tier: "essential",
        billing_cycle: BillingCycle.MONTHLY,
        payer,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("permite checkout de tier DIFERENTE com assinatura ativa (upgrade)", async () => {
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
      plan_tier: "pro",
      billing_cycle: BillingCycle.MONTHLY,
      payer,
    });

    expect(output.amount_brl).toBe(74.9);
  });

  it("checkout de estabelecimento usa a tabela de preços da persona", async () => {
    const establishment_id = new Uuid().id;

    const output = await useCase.execute({
      persona: "establishment",
      entity_id: establishment_id,
      plan_tier: "growth",
      billing_cycle: BillingCycle.MONTHLY,
      payer,
    });

    expect(output.amount_brl).toBe(34.9);
    const sub = gateway.subscriptions.get(output.gateway_subscription_id);
    expect(sub?.external_reference).toBe(
      `sub:establishment:${establishment_id}:growth:monthly`,
    );
  });

  it("falha do gateway vira ExternalServiceError (503)", async () => {
    jest
      .spyOn(gateway, "createCustomer")
      .mockRejectedValueOnce(new SubscriptionBillingError("boom"));

    await expect(() =>
      useCase.execute({
        persona: "musician",
        entity_id: new Uuid().id,
        plan_tier: "pro",
        billing_cycle: BillingCycle.MONTHLY,
        payer,
      }),
    ).rejects.toThrow(ExternalServiceError);
  });
});
