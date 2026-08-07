import { Module } from "@nestjs/common";

import { PlanCheckService } from "../../core/plans";
import { ActivateSubscriptionFromPaymentUseCase } from "../../core/plans/application/use-cases/activate-subscription-from-payment/activate-subscription-from-payment.use-case";
import { DatabaseModule } from "../database-module/database.module";
import { PlansController } from "./plans.controller";
import { PLAN_PROVIDERS } from "./plans.providers";

@Module({
  imports: [DatabaseModule],
  controllers: [PlansController],
  providers: [
    ...Object.values(PLAN_PROVIDERS.REPOSITORIES),
    ...Object.values(PLAN_PROVIDERS.GATEWAYS),
    ...Object.values(PLAN_PROVIDERS.SERVICES),
    ...Object.values(PLAN_PROVIDERS.USE_CASES),
  ],
  // ActivateSubscriptionFromPaymentUseCase é consumido pelo AsaasWebhookController
  // (payment-module, que já importa PlansModule).
  exports: [PlanCheckService, ActivateSubscriptionFromPaymentUseCase],
})
export class PlansModule {}
