import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BillingCycle } from "../../../../domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../infra/db/in-memory/subscription-in-memory.repository";
import { FakeSubscriptionBillingGateway } from "../../../../infra/gateways/fake-subscription-billing.gateway";
import { ActivateSubscriptionFromPaymentUseCase } from "../activate-subscription-from-payment.use-case";

describe("ActivateSubscriptionFromPaymentUseCase Unit Tests", () => {
  let useCase: ActivateSubscriptionFromPaymentUseCase;
  let repo: SubscriptionInMemoryRepository;
  let gateway: FakeSubscriptionBillingGateway;

  beforeEach(() => {
    repo = new SubscriptionInMemoryRepository();
    gateway = new FakeSubscriptionBillingGateway();
    useCase = new ActivateSubscriptionFromPaymentUseCase(repo, gateway);
  });

  it("ativa assinatura nova a partir do external_reference do pagamento", async () => {
    const musician_id = new Uuid().id;

    const result = await useCase.execute({
      gateway_subscription_id: "asaas_sub_1",
      external_reference: `sub:musician:${musician_id}:essential:monthly`,
      gateway_customer_id: "asaas_cus_1",
    });

    expect(result.action).toBe("activated");
    const active = await repo.findActiveMusicianSubscription(musician_id);
    expect(active).not.toBeNull();
    expect(active!.plan_tier).toBe("essential");
    expect(active!.billing_cycle).toBe(BillingCycle.MONTHLY);
    expect(active!.gateway_subscription_id).toBe("asaas_sub_1");
    expect(active!.gateway_customer_id).toBe("asaas_cus_1");
    expect(active!.isActive()).toBe(true);
  });

  it("pagamento recorrente da mesma assinatura renova o ciclo (não duplica)", async () => {
    const musician_id = new Uuid().id;
    await useCase.execute({
      gateway_subscription_id: "asaas_sub_1",
      external_reference: `sub:musician:${musician_id}:essential:monthly`,
    });
    const first = await repo.findActiveMusicianSubscription(musician_id);
    const firstExpiry = first!.expires_at!;

    const result = await useCase.execute({
      gateway_subscription_id: "asaas_sub_1",
      external_reference: `sub:musician:${musician_id}:essential:monthly`,
    });

    expect(result.action).toBe("renewed");
    expect(await repo.findAll()).toHaveLength(1);
    const renewed = await repo.findActiveMusicianSubscription(musician_id);
    expect(renewed!.expires_at!.getTime()).toBeGreaterThanOrEqual(
      firstExpiry.getTime(),
    );
  });

  it("upgrade: cancela a assinatura ativa anterior (local e no gateway) e ativa a nova", async () => {
    const musician_id = new Uuid().id;
    const old = Subscription.create({
      musician_id,
      persona: "musician",
      plan_tier: "essential",
      billing_cycle: BillingCycle.MONTHLY,
      gateway_subscription_id: "asaas_sub_old",
    });
    await repo.insert(old);

    const result = await useCase.execute({
      gateway_subscription_id: "asaas_sub_new",
      external_reference: `sub:musician:${musician_id}:pro:monthly`,
    });

    expect(result.action).toBe("activated");
    expect(gateway.cancelled).toContain("asaas_sub_old");

    const oldReloaded = await repo.findById(old.subscription_id);
    expect(oldReloaded!.status).toBe(SubscriptionStatus.CANCELLED);

    const active = await repo.findActiveMusicianSubscription(musician_id);
    expect(active!.plan_tier).toBe("pro");
    expect(active!.gateway_subscription_id).toBe("asaas_sub_new");
  });

  it("sem external_reference no payload, busca a referência no gateway", async () => {
    const musician_id = new Uuid().id;
    const checkout = await gateway.createSubscription({
      gateway_customer_id: "cus",
      value_brl: 34.9,
      cycle: BillingCycle.MONTHLY,
      description: "test",
      external_reference: `sub:musician:${musician_id}:essential:monthly`,
    });

    const result = await useCase.execute({
      gateway_subscription_id: checkout.gateway_subscription_id,
      external_reference: null,
    });

    expect(result.action).toBe("activated");
    expect(
      await repo.findActiveMusicianSubscription(musician_id),
    ).not.toBeNull();
  });

  it("referência inválida/desconhecida → ignored, sem lançar (webhook precisa de 200)", async () => {
    const result = await useCase.execute({
      gateway_subscription_id: "asaas_sub_unknown",
      external_reference: "algo-que-nao-e-sub",
    });

    expect(result.action).toBe("ignored");
    expect(await repo.findAll()).toHaveLength(0);
  });

  it("gateway_subscription_id vazio → ignored", async () => {
    const result = await useCase.execute({
      gateway_subscription_id: "",
      external_reference: `sub:musician:${new Uuid().id}:pro:monthly`,
    });

    expect(result.action).toBe("ignored");
  });

  it("assinatura local CANCELADA não renova com pagamento residual atrasado", async () => {
    const musician_id = new Uuid().id;
    const sub = Subscription.create({
      musician_id,
      persona: "musician",
      plan_tier: "essential",
      billing_cycle: BillingCycle.MONTHLY,
      gateway_subscription_id: "asaas_sub_1",
    });
    sub.cancel();
    await repo.insert(sub);

    const result = await useCase.execute({
      gateway_subscription_id: "asaas_sub_1",
      external_reference: `sub:musician:${musician_id}:essential:monthly`,
    });

    // Encontrou o vínculo → caminho de renovação, mas renew() em cancelada é no-op.
    expect(result.action).toBe("renewed");
    const reloaded = await repo.findById(sub.subscription_id);
    expect(reloaded!.status).toBe(SubscriptionStatus.CANCELLED);
  });

  it("ativação de estabelecimento resolve a persona correta", async () => {
    const establishment_id = new Uuid().id;

    const result = await useCase.execute({
      gateway_subscription_id: "asaas_sub_est",
      external_reference: `sub:establishment:${establishment_id}:growth:annual`,
    });

    expect(result.action).toBe("activated");
    const active =
      await repo.findActiveEstablishmentSubscription(establishment_id);
    expect(active!.plan_tier).toBe("growth");
    expect(active!.billing_cycle).toBe(BillingCycle.ANNUAL);
  });
});
