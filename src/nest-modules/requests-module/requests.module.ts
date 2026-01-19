import { Module } from "@nestjs/common";

import { AudiencesModule } from "../audiences-module/audiences.module";
import { DatabaseModule } from "../database-module/database.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { RequestEventsHandlers } from "./request-events.handlers";
import { RequestsController } from "./requests.controller";
import { REQUESTS_PROVIDERS } from "./requests.providers";

@Module({
  imports: [DatabaseModule, MusiciansModule, AudiencesModule],
  controllers: [RequestsController],
  providers: [
    ...Object.values(REQUESTS_PROVIDERS.REPOSITORIES),
    ...Object.values(REQUESTS_PROVIDERS.USE_CASES),
    RequestEventsHandlers,
  ],
  exports: [REQUESTS_PROVIDERS.REPOSITORIES.REQUEST_REPOSITORY.provide],
})
export class RequestsModule {}
