import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { MusiciansModule } from "./nest-modules/musicians-module/musicians.module";
import { DatabaseModule } from "./nest-modules/database-module/database.module";
import { ConfigModuleRoot } from "./nest-modules/config-module/config-module.module";

// Nest Modules
// External Nest modules removed from project

@Module({
  imports: [
    ConfigModuleRoot.forRoot(),
    
    // Module
    DatabaseModule,
    MusiciansModule,

    // Event System
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: ".",
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Infrastructure
    // Domain modules removed
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
