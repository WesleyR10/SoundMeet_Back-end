import { forwardRef, Module } from "@nestjs/common";

import { AudiencesModule } from "../audiences-module/audiences.module";
import { DatabaseModule } from "../database-module/database.module";
import { EventModule } from "../events-module/events.module";
import { GamificationModule } from "../gamification-module/gamification.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { RequestEventProcessingService } from "./request-event-processing.service";
import { RequestEventsHandlers } from "./request-events.handlers";
import { RequestsController } from "./requests.controller";
import { REQUESTS_PROVIDERS } from "./requests.providers";

@Module({
  imports: [
    DatabaseModule,
    MusiciansModule,
    EventModule,
    GamificationModule,
    forwardRef(() => AudiencesModule),
  ],
  controllers: [RequestsController],
  providers: [
    ...Object.values(REQUESTS_PROVIDERS.REPOSITORIES),
    ...Object.values(REQUESTS_PROVIDERS.SERVICES),
    ...Object.values(REQUESTS_PROVIDERS.USE_CASES),
    RequestEventProcessingService,
    RequestEventsHandlers,
  ],
  exports: [
    REQUESTS_PROVIDERS.REPOSITORIES.REQUEST_REPOSITORY.provide,
    REQUESTS_PROVIDERS.REPOSITORIES.REQUEST_VOTE_REPOSITORY.provide,
    REQUESTS_PROVIDERS.USE_CASES.CREATE_REQUEST_USE_CASE.provide,
    REQUESTS_PROVIDERS.USE_CASES.VOTE_REQUEST_USE_CASE.provide,
  ],
})
export class RequestsModule {}
