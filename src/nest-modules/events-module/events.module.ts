import { Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { DatabaseModule } from "../database-module/database.module";
import { AutoFinishEventsJob } from "./auto-finish-events.job";
import { EventsController } from "./events.controller";
import { EVENTS_PROVIDERS } from "./events.providers";
import { EventsDiscoveryController } from "./events-discovery.controller";

@Global()
@Module({
  imports: [DatabaseModule, EventEmitterModule.forRoot()],
  controllers: [EventsController, EventsDiscoveryController],
  providers: [
    AutoFinishEventsJob,
    ...Object.values(EVENTS_PROVIDERS.REPOSITORIES),
    ...Object.values(EVENTS_PROVIDERS.USE_CASES),
    ...Object.values(EVENTS_PROVIDERS.EVENTS),
  ],
  exports: [
    EVENTS_PROVIDERS.REPOSITORIES.EVENT_REPOSITORY.provide,
    EVENTS_PROVIDERS.REPOSITORIES.EVENT_ATTENDEE_REPOSITORY.provide,
    EVENTS_PROVIDERS.REPOSITORIES.EVENT_MUSICIAN_REPOSITORY.provide,
    EVENTS_PROVIDERS.USE_CASES.ADD_EVENT_ATTENDEE_USE_CASE.provide,
    EVENTS_PROVIDERS.USE_CASES.ADD_EVENT_PERFORMER_USE_CASE.provide,
    EVENTS_PROVIDERS.EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
  ],
})
export class EventModule {}
