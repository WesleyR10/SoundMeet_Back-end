import { Module } from "@nestjs/common";

import { EstablishmentsModule } from "../establishments-module/establishments.module";
import { EventModule } from "../events-module/events.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { SchedulingModule } from "../scheduling-module/scheduling.module";
import { EstablishmentRatingsController } from "./establishment-ratings.controller";
import { MusicianRatingsController } from "./musician-ratings.controller";
import { REVIEWS_PROVIDERS } from "./reviews.providers";

// Módulo orquestrador (Bloco 9.3) — a avaliação cruza quatro bounded contexts:
// grava no ledger próprio, prova o vínculo em scheduling/events e atualiza a
// projeção em musician/establishment.
//
// Não vive dentro de MusiciansModule/EstablishmentsModule porque precisaria
// importar Scheduling e Events de volta, e aqueles já são importados por eles —
// o ciclo estático de import quebra no carregamento (TDZ), antes do NestJS
// resolver a DI. Mesmo padrão de nó-folha já usado por MusicianAnalyticsModule
// e NotificationsModule.
@Module({
  imports: [
    MusiciansModule,
    EstablishmentsModule,
    SchedulingModule,
    EventModule,
  ],
  controllers: [MusicianRatingsController, EstablishmentRatingsController],
  providers: [
    ...Object.values(REVIEWS_PROVIDERS.REPOSITORIES),
    ...Object.values(REVIEWS_PROVIDERS.SERVICES),
    ...Object.values(REVIEWS_PROVIDERS.USE_CASES),
  ],
  exports: [REVIEWS_PROVIDERS.REPOSITORIES.REVIEW_REPOSITORY.provide],
})
export class ReviewsModule {}
