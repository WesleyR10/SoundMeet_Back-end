import { ConfigService } from "@nestjs/config";

import { PlanCheckService } from "../../core/plans";
import { ISubscriptionBillingGateway } from "../../core/plans/application/ports/subscription-billing.gateway";
import { ActivateSubscriptionFromPaymentUseCase } from "../../core/plans/application/use-cases/activate-subscription-from-payment/activate-subscription-from-payment.use-case";
import { CancelSubscriptionUseCase } from "../../core/plans/application/use-cases/cancel-subscription/cancel-subscription.use-case";
import { CreateSubscriptionCheckoutUseCase } from "../../core/plans/application/use-cases/create-subscription-checkout/create-subscription-checkout.use-case";
import { GetActiveSubscriptionUseCase } from "../../core/plans/application/use-cases/get-active-subscription/get-active-subscription.use-case";
import { ListPlansUseCase } from "../../core/plans/application/use-cases/list-plans/list-plans.use-case";
import { ISubscriptionRepository } from "../../core/plans/domain/subscription.repository";
import { SubscriptionPrismaRepository } from "../../core/plans/infra/db/prisma/subscription-prisma.repository";
import { AsaasSubscriptionGateway } from "../../core/plans/infra/gateways/asaas-subscription.gateway";
import { FakeSubscriptionBillingGateway } from "../../core/plans/infra/gateways/fake-subscription-billing.gateway";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const PLAN_PROVIDERS = {
  REPOSITORIES: {
    SUBSCRIPTION_REPOSITORY: {
      provide: "SubscriptionRepository",
      useFactory: (prismaService: PrismaService) =>
        new SubscriptionPrismaRepository(prismaService),
      inject: [PrismaService],
    },
  },
  GATEWAYS: {
    // Sem ASAAS_API_KEY → fake (dev/testes locais), mesmo precedente do
    // PixGatewayMock. Em produção o Joi exige a chave, então o fake nunca
    // vira o binding de prod.
    SUBSCRIPTION_BILLING_GATEWAY: {
      provide: "SubscriptionBillingGateway",
      useFactory: (
        configService: ConfigService,
      ): ISubscriptionBillingGateway => {
        const apiKey = configService.get<string>("ASAAS_API_KEY");
        const apiUrl =
          configService.get<string>("ASAAS_API_URL") ??
          "https://sandbox.asaas.com/api/v3";
        return apiKey
          ? new AsaasSubscriptionGateway(apiUrl, apiKey)
          : new FakeSubscriptionBillingGateway();
      },
      inject: [ConfigService],
    },
  },
  SERVICES: {
    PLAN_CHECK_SERVICE: {
      provide: PlanCheckService,
      useFactory: (subscriptionRepo: ISubscriptionRepository) =>
        new PlanCheckService(subscriptionRepo),
      inject: ["SubscriptionRepository"],
    },
  },
  USE_CASES: {
    LIST_PLANS_USE_CASE: {
      provide: ListPlansUseCase,
      useFactory: () => new ListPlansUseCase(),
    },
    GET_ACTIVE_SUBSCRIPTION_USE_CASE: {
      provide: GetActiveSubscriptionUseCase,
      useFactory: (subscriptionRepo: ISubscriptionRepository) =>
        new GetActiveSubscriptionUseCase(subscriptionRepo),
      inject: ["SubscriptionRepository"],
    },
    CREATE_SUBSCRIPTION_CHECKOUT_USE_CASE: {
      provide: CreateSubscriptionCheckoutUseCase,
      useFactory: (
        subscriptionRepo: ISubscriptionRepository,
        billingGateway: ISubscriptionBillingGateway,
      ) =>
        new CreateSubscriptionCheckoutUseCase(subscriptionRepo, billingGateway),
      inject: ["SubscriptionRepository", "SubscriptionBillingGateway"],
    },
    CANCEL_SUBSCRIPTION_USE_CASE: {
      provide: CancelSubscriptionUseCase,
      useFactory: (
        subscriptionRepo: ISubscriptionRepository,
        billingGateway: ISubscriptionBillingGateway,
      ) => new CancelSubscriptionUseCase(subscriptionRepo, billingGateway),
      inject: ["SubscriptionRepository", "SubscriptionBillingGateway"],
    },
    ACTIVATE_SUBSCRIPTION_FROM_PAYMENT_USE_CASE: {
      provide: ActivateSubscriptionFromPaymentUseCase,
      useFactory: (
        subscriptionRepo: ISubscriptionRepository,
        billingGateway: ISubscriptionBillingGateway,
      ) =>
        new ActivateSubscriptionFromPaymentUseCase(
          subscriptionRepo,
          billingGateway,
        ),
      inject: ["SubscriptionRepository", "SubscriptionBillingGateway"],
    },
  },
};
