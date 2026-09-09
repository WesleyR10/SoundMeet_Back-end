import { Module } from "@nestjs/common";

import { EstablishmentsModule } from "../establishments-module/establishments.module";
import { EventModule } from "../events-module/events.module";
import { MusicLibraryModule } from "../music-library-module/music-library.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentModule } from "../payment-module/payment.module";
import { RequestsModule } from "../requests-module/requests.module";
import { ReviewsModule } from "../reviews-module/reviews.module";
import { SchedulingModule } from "../scheduling-module/scheduling.module";
import { LivePerformanceController } from "./live-performance.controller";
import { MusicianPerformanceController } from "./musician-performance.controller";
import { PerformanceController } from "./performance.controller";
import { PERFORMANCE_PROVIDERS } from "./performance.providers";
import { PerformanceEventsHandlers } from "./performance-events.handlers";

/**
 * Apresentação ao vivo (F0) + currículo verificado (F4) + setlist inteligente
 * (F5) + relatório pós-show (F6).
 *
 * Ver `Docs/performance/live-performance.md`.
 *
 * ## Nó-folha
 *
 * Importa sete módulos e **não é importado por nenhum**. Mesmo motivo já
 * documentado em `ReviewsModule`: os módulos abaixo importam uns aos outros, e
 * um import de volta fecharia ciclo estático que quebra no carregamento (TDZ),
 * antes de o NestJS resolver a DI.
 *
 * ## 🔴 A ordem dos controllers é significativa
 *
 * `LivePerformanceController` (`@Get("live")`) vem ANTES de
 * `PerformanceController` (`@Get(":performance_id")`). O Nest registra as rotas
 * na ordem deste array; invertido, `/performances/live` casaria como
 * `:performance_id`, o `ParseUUIDPipe` responderia 422 e a feature do fã
 * simplesmente não existiria — sem erro de compilação e sem erro de startup.
 *
 * É a mesma armadilha de ordem de rota que o `contract-module` registra, aqui
 * agravada por estar espalhada em dois arquivos: o `@Get("live")` está correto
 * no seu próprio controller e ainda assim quebra se este array mudar.
 */
@Module({
  imports: [
    MusiciansModule,
    EstablishmentsModule,
    EventModule,
    SchedulingModule,
    RequestsModule,
    MusicLibraryModule,
    PaymentModule,
    ReviewsModule,
  ],
  controllers: [
    LivePerformanceController,
    PerformanceController,
    MusicianPerformanceController,
  ],
  providers: [
    ...Object.values(PERFORMANCE_PROVIDERS.REPOSITORIES),
    ...Object.values(PERFORMANCE_PROVIDERS.SERVICES),
    ...Object.values(PERFORMANCE_PROVIDERS.USE_CASES),
    PerformanceEventsHandlers,
  ],
  exports: [PERFORMANCE_PROVIDERS.REPOSITORIES.PERFORMANCE_REPOSITORY.provide],
})
export class PerformanceModule {}
