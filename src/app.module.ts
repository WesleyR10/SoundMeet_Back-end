import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { HealthController } from "./health.controller";
import { AudiencesModule } from "./nest-modules/audiences-module/audiences.module";
import { ConfigModuleRoot } from "./nest-modules/config-module/config-module.module";
import { DatabaseModule } from "./nest-modules/database-module/database.module";
import { EstablishmentsModule } from "./nest-modules/establishments-module/establishments.module";
import { EventModule } from "./nest-modules/events-module/events.module";
import { GamificationModule } from "./nest-modules/gamification-module/gamification.module";
import { MusiciansModule } from "./nest-modules/musicians-module/musicians.module";
import { RequestsModule } from "./nest-modules/requests-module/requests.module";
import { SchedulingModule } from "./nest-modules/scheduling-module/scheduling.module";

// Nest Modules
// External Nest modules removed from project

@Module({
  imports: [
    ConfigModuleRoot.forRoot(),

    // Module
    DatabaseModule,
    MusiciansModule,
    EstablishmentsModule,
    AudiencesModule,
    RequestsModule,
    EventModule,
    SchedulingModule,
    GamificationModule,

    // Event System
    // messaging-module

    // Scheduler
    ScheduleModule.forRoot(),

    // Infrastructure
    // Domain modules removed
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
