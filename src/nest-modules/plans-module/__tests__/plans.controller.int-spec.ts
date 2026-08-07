import { Test, TestingModule } from "@nestjs/testing";

import {
  ActivateSubscriptionFromPaymentUseCase,
  BillingCycle,
  CancelSubscriptionUseCase,
  CreateSubscriptionCheckoutUseCase,
  FakeSubscriptionBillingGateway,
  GetActiveSubscriptionUseCase,
  ListPlansUseCase,
  Subscription,
  SubscriptionInMemoryRepository,
} from "../../../core/plans";
import { AuthGuard } from "../../auth-module/auth.guard";
import { RolesGuard } from "../../auth-module/roles.guard";
import { PlansController } from "../plans.controller";
import {
  ActiveSubscriptionPresenter,
  PlansCatalogPresenter,
  SubscriptionCheckoutPresenter,
  SubscriptionPresenter,
} from "../plans.presenter";

describe("PlansController Integration Tests", () => {
  let controller: PlansController;
  let repo: SubscriptionInMemoryRepository;
  let gateway: FakeSubscriptionBillingGateway;

  const MUSICIAN_ID = "11111111-1111-4111-8111-111111111111";

  const checkoutDto = {
    plan_tier: "essential",
    billing_cycle: BillingCycle.MONTHLY,
    payer_name: "João da Silva",
    payer_email: "joao@email.com",
    payer_cpf_cnpj: "123.456.789-09",
  };

  beforeEach(async () => {
    repo = new SubscriptionInMemoryRepository();
    gateway = new FakeSubscriptionBillingGateway();
    const passGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        { provide: ListPlansUseCase, useValue: new ListPlansUseCase() },
        {
          provide: GetActiveSubscriptionUseCase,
          useValue: new GetActiveSubscriptionUseCase(repo),
        },
        {
          provide: CreateSubscriptionCheckoutUseCase,
          useValue: new CreateSubscriptionCheckoutUseCase(repo, gateway),
        },
        {
          provide: CancelSubscriptionUseCase,
          useValue: new CancelSubscriptionUseCase(repo, gateway),
        },
        {
          provide: ActivateSubscriptionFromPaymentUseCase,
          useValue: new ActivateSubscriptionFromPaymentUseCase(repo, gateway),
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(passGuard)
      .overrideGuard(RolesGuard)
      .useValue(passGuard)
      .compile();

    controller = module.get<PlansController>(PlansController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("listPlans", () => {
    it("retorna o catálogo público sem exigir autenticação", async () => {
      const result = await controller.listPlans();

      expect(result).toBeInstanceOf(PlansCatalogPresenter);
      expect(result.musician).toHaveLength(3);
      expect(result.establishment).toHaveLength(3);
    });
  });

  describe("getMusicianSubscription", () => {
    it("retorna free quando o músico não tem assinatura", async () => {
      const result = await controller.getMusicianSubscription(MUSICIAN_ID);

      expect(result).toBeInstanceOf(ActiveSubscriptionPresenter);
      expect(result.effective_tier).toBe("free");
      expect(result.subscription).toBeNull();
    });

    it("retorna a assinatura ativa quando existe", async () => {
      await repo.insert(
        Subscription.create({
          musician_id: MUSICIAN_ID,
          persona: "musician",
          plan_tier: "pro",
          billing_cycle: BillingCycle.MONTHLY,
        }),
      );

      const result = await controller.getMusicianSubscription(MUSICIAN_ID);

      expect(result.effective_tier).toBe("pro");
    });
  });

  describe("createMusicianCheckout", () => {
    it("cria o checkout e retorna a URL de pagamento", async () => {
      const result = await controller.createMusicianCheckout(
        MUSICIAN_ID,
        checkoutDto,
      );

      expect(result).toBeInstanceOf(SubscriptionCheckoutPresenter);
      expect(result.checkout_url).toContain("fake-checkout");
      expect(result.amount_brl).toBe(34.9);
    });

    it("propaga 409 quando já existe assinatura ativa no mesmo plano/ciclo", async () => {
      await repo.insert(
        Subscription.create({
          musician_id: MUSICIAN_ID,
          persona: "musician",
          plan_tier: "essential",
          billing_cycle: BillingCycle.MONTHLY,
        }),
      );

      await expect(() =>
        controller.createMusicianCheckout(MUSICIAN_ID, checkoutDto),
      ).rejects.toThrow();
    });
  });

  describe("cancelMusicianSubscription", () => {
    it("cancela a assinatura ativa do músico", async () => {
      await repo.insert(
        Subscription.create({
          musician_id: MUSICIAN_ID,
          persona: "musician",
          plan_tier: "essential",
          billing_cycle: BillingCycle.MONTHLY,
        }),
      );

      const result = await controller.cancelMusicianSubscription(MUSICIAN_ID);

      expect(result).toBeInstanceOf(SubscriptionPresenter);
      expect(result.status).toBe("cancelled");
    });

    it("lança quando não há assinatura ativa para cancelar", async () => {
      await expect(() =>
        controller.cancelMusicianSubscription(MUSICIAN_ID),
      ).rejects.toThrow();
    });
  });

  // Fluxo ponta a ponta: checkout → webhook confirma pagamento (via
  // ActivateSubscriptionFromPaymentUseCase, o mesmo caminho do
  // AsaasWebhookController) → GET reflete o novo tier.
  describe("fluxo completo — checkout até ativação", () => {
    it("checkout não ativa; ativação simulada do webhook faz o GET refletir o tier pago", async () => {
      const checkout = await controller.createMusicianCheckout(
        MUSICIAN_ID,
        checkoutDto,
      );

      const beforeActivation =
        await controller.getMusicianSubscription(MUSICIAN_ID);
      expect(beforeActivation.effective_tier).toBe("free");

      const activateUseCase = new ActivateSubscriptionFromPaymentUseCase(
        repo,
        gateway,
      );
      await activateUseCase.execute({
        gateway_subscription_id: checkout.gateway_subscription_id,
        external_reference: `sub:musician:${MUSICIAN_ID}:essential:monthly`,
      });

      const afterActivation =
        await controller.getMusicianSubscription(MUSICIAN_ID);
      expect(afterActivation.effective_tier).toBe("essential");
    });
  });

  describe("persona estabelecimento", () => {
    const ESTABLISHMENT_ID = "33333333-3333-4333-8333-333333333333";

    it("segue o mesmo contrato de checkout/cancel/get da persona músico", async () => {
      const checkout = await controller.createEstablishmentCheckout(
        ESTABLISHMENT_ID,
        { ...checkoutDto, plan_tier: "growth" },
      );
      expect(checkout.amount_brl).toBe(34.9);

      await new ActivateSubscriptionFromPaymentUseCase(repo, gateway).execute({
        gateway_subscription_id: checkout.gateway_subscription_id,
        external_reference: `sub:establishment:${ESTABLISHMENT_ID}:growth:monthly`,
      });

      const active =
        await controller.getEstablishmentSubscription(ESTABLISHMENT_ID);
      expect(active.effective_tier).toBe("growth");

      const cancelled =
        await controller.cancelEstablishmentSubscription(ESTABLISHMENT_ID);
      expect(cancelled.status).toBe("cancelled");
    });
  });
});
