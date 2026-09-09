import { forwardRef, Module } from "@nestjs/common";

import { AudiencesModule } from "../audiences-module/audiences.module";
import { DatabaseModule } from "../database-module/database.module";
import { EventModule } from "../events-module/events.module";
import { GamificationModule } from "../gamification-module/gamification.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentModule } from "../payment-module/payment.module";
import { BoostChargeAdapter } from "./boost-charge.adapter";
import { ExpireRequestBoostsJob } from "./expire-request-boosts.job";
import { RequestBoostEventsHandler } from "./request-boost-events.handler";
import { RequestEventProcessingService } from "./request-event-processing.service";
import { RequestEventsHandlers } from "./request-events.handlers";
import { RequestsController } from "./requests.controller";
import { REQUESTS_PROVIDERS } from "./requests.providers";
import { TipEligibilityAdapter } from "./tip-eligibility.adapter";

@Module({
  imports: [
    DatabaseModule,
    MusiciansModule,
    EventModule,
    GamificationModule,
    /*
     * Destaque pago do pedido: as portas `IBoostChargePort` e
     * `ITipEligibilityPort` são satisfeitas por adapters que falam com
     * `SendTipUseCase` e `MusicianWallet`.
     *
     * Direção segura: `PaymentModule` importa Database/Musicians/Gamification/
     * Plans/Scheduling e NÃO importa `RequestsModule` — não há ciclo. A
     * dependência inversa (payment precisar de request) é resolvida por evento
     * de domínio, nunca por import.
     */
    PaymentModule,
    forwardRef(() => AudiencesModule),
  ],
  controllers: [RequestsController],
  providers: [
    ...Object.values(REQUESTS_PROVIDERS.REPOSITORIES),
    ...Object.values(REQUESTS_PROVIDERS.SERVICES),
    ...Object.values(REQUESTS_PROVIDERS.USE_CASES),
    RequestEventProcessingService,
    RequestEventsHandlers,
    BoostChargeAdapter,
    TipEligibilityAdapter,
    RequestBoostEventsHandler,
    ExpireRequestBoostsJob,
  ],
  exports: [
    REQUESTS_PROVIDERS.REPOSITORIES.REQUEST_REPOSITORY.provide,
    REQUESTS_PROVIDERS.REPOSITORIES.REQUEST_VOTE_REPOSITORY.provide,
    REQUESTS_PROVIDERS.USE_CASES.CREATE_REQUEST_USE_CASE.provide,
    REQUESTS_PROVIDERS.USE_CASES.VOTE_REQUEST_USE_CASE.provide,
    // Consumidos pelo PerformanceModule: quando o músico registra que tocou um
    // pedido, o handler de `SongStartedEvent` fecha o ciclo marcando o pedido
    // como tocado — sem isso haveria duas verdades sobre o mesmo fato.
    REQUESTS_PROVIDERS.USE_CASES.MARK_REQUEST_PLAYED_USE_CASE.provide,
    RequestEventProcessingService,
  ],
})
export class RequestsModule {}
