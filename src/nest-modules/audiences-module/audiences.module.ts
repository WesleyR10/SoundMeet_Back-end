import { forwardRef, Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { EventModule } from "../events-module/events.module";
import { GamificationModule } from "../gamification-module/gamification.module";
import { IndicationsModule } from "../indications-module/indications.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentModule } from "../payment-module/payment.module";
import { RequestsModule } from "../requests-module/requests.module";
import { AudienceEventsHandlers } from "./audience-events.handlers";
import { AudiencesController } from "./audiences.controller";
import { AUDIENCES_PROVIDERS } from "./audiences.providers";
import { RefreshSpotifyTokensJob } from "./refresh-spotify-tokens.job";
import { SpotifyController } from "./spotify.controller";
import { SpotifyCallbackController } from "./spotify-callback.controller";
import { SpotifyEnabledGuard } from "./spotify-enabled.guard";

@Module({
  imports: [
    DatabaseModule,
    MusiciansModule,
    EventModule,
    GamificationModule,
    // Fornece o `RecordIndicationUseCase` ao handler de `MusicianIndicatedEvent`.
    // A direção é audiences → indication; `IndicationsModule` é nó-folha.
    IndicationsModule,
    PaymentModule,
    forwardRef(() => RequestsModule),
  ],
  controllers: [
    AudiencesController,
    SpotifyController,
    /*
     * Callback OAuth em controller SEPARADO: `SpotifyController` tem
     * `@UseGuards` na classe, e um `@Public()` solto ali é a exceção que
     * alguém remove sem perceber ao refatorar. Mesma decisão de
     * `MercadoPagoCallbackController`.
     */
    SpotifyCallbackController,
  ],
  providers: [
    AudienceEventsHandlers,
    ...Object.values(AUDIENCES_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(AUDIENCES_PROVIDERS.REPOSITORIES),
    ...Object.values(AUDIENCES_PROVIDERS.EVENTS),
    ...Object.values(AUDIENCES_PROVIDERS.USE_CASES),
    ...Object.values(AUDIENCES_PROVIDERS.SPOTIFY_USE_CASES),
    RefreshSpotifyTokensJob,
    SpotifyEnabledGuard,
  ],
  exports: [AUDIENCES_PROVIDERS.REPOSITORIES.AUDIENCE_REPOSITORY.provide],
})
export class AudiencesModule {}
