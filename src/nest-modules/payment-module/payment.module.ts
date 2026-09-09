import { Module } from "@nestjs/common";

import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { PrismaEmailVerificationChecker } from "../auth-module/prisma-email-verification.checker";
import { DatabaseModule } from "../database-module/database.module";
import { GamificationModule } from "../gamification-module/gamification.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PlansModule } from "../plans-module/plans.module";
import { RabbitmqModule } from "../rabbitmq-module/rabbitmq.module";
import { SchedulingModule } from "../scheduling-module/scheduling.module";
import { AsaasWebhookController } from "./asaas-webhook.controller";
import { BookingEscrowCreationHandler } from "./booking-escrow-creation.handler";
import { EscrowReleaseJob } from "./escrow-release.job";
import { MercadoPagoCallbackController } from "./mercadopago-callback.controller";
import { MercadoPagoWebhookController } from "./mercadopago-webhook.controller";
import { PaymentController } from "./payment.controller";
import { PAYMENT_PROVIDERS } from "./payment.providers";
import { PaymentEventProcessingService } from "./payment-event-processing.service";
import { PaymentEventsHandlers } from "./payment-events.handlers";
import { RefreshMercadoPagoTokensJob } from "./refresh-mercadopago-tokens.job";

@Module({
  imports: [
    DatabaseModule,
    MusiciansModule,
    GamificationModule,
    PlansModule,
    /*
     * A liberação da custódia precisa do booking para conferir o check-in e a
     * contestação. `SchedulingModule` não importa `PaymentModule` (só
     * `DatabaseModule` e `MusiciansModule`), então não há ciclo.
     */
    SchedulingModule,
    RabbitmqModule.forFeature(),
  ],
  controllers: [
    PaymentController,
    AsaasWebhookController,
    /*
     * Callback OAuth em controller SEPARADO: `PaymentController` tem
     * `@UseGuards` na classe, e um `@Public()` solto ali é a exceção que alguém
     * remove sem perceber ao refatorar. Mesma decisão de
     * `contract-verification.controller.ts`.
     */
    MercadoPagoCallbackController,
    MercadoPagoWebhookController,
  ],
  providers: [
    // Adapter da porta de e-mail confirmado (gate do saque PIX). Declarado
    // aqui, e não via import do AuthModule, para não criar aresta nova entre
    // os módulos por causa de uma classe que só depende do PrismaService.
    PrismaEmailVerificationChecker,
    ...Object.values(PAYMENT_PROVIDERS.REPOSITORIES),
    ...Object.values(PAYMENT_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(PAYMENT_PROVIDERS.USE_CASES),
    DomainEventMediator,
    PaymentEventProcessingService,
    PaymentEventsHandlers,
    BookingEscrowCreationHandler,
    EscrowReleaseJob,
    RefreshMercadoPagoTokensJob,
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
