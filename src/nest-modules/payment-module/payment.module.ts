import { Module } from "@nestjs/common";

import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { AsaasWebhookController } from "./asaas-webhook.controller";
import { DatabaseModule } from "../database-module/database.module";
import { GamificationModule } from "../gamification-module/gamification.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentController } from "./payment.controller";
import { PAYMENT_PROVIDERS } from "./payment.providers";
import { PaymentEventProcessingService } from "./payment-event-processing.service";
import { PaymentEventsHandlers } from "./payment-events.handlers";

@Module({
  imports: [DatabaseModule, MusiciansModule, GamificationModule],
  controllers: [PaymentController, AsaasWebhookController],
  providers: [
    ...Object.values(PAYMENT_PROVIDERS.REPOSITORIES),
    ...Object.values(PAYMENT_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(PAYMENT_PROVIDERS.USE_CASES),
    DomainEventMediator,
    PaymentEventProcessingService,
    PaymentEventsHandlers,
  ],
  exports: [
    PAYMENT_PROVIDERS.REPOSITORIES.TIP_REPOSITORY.provide,
    PAYMENT_PROVIDERS.REPOSITORIES.TRANSACTION_REPOSITORY.provide,
    PAYMENT_PROVIDERS.REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide,
    PAYMENT_PROVIDERS.USE_CASES.SEND_TIP_USE_CASE.provide,
    PAYMENT_PROVIDERS.USE_CASES.CONFIRM_TIP_PAYMENT_USE_CASE.provide,
  ],
})
export class PaymentModule {}
