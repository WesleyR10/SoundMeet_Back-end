import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

// Nest Modules
import { ConfigModuleRoot } from "./nest-modules/config-module/config.module";
import { DatabaseModule } from "./nest-modules/database-module/database.module";
import { SharedModule } from "./nest-modules/shared-module/shared.module";
import { AuthModule } from "./nest-modules/auth-module/auth.module";
import { MusicianModule } from "./nest-modules/musician-module/musician.module";
import { EstablishmentModule } from "./nest-modules/establishment-module/establishment.module";
import { AudienceModule } from "./nest-modules/audience-module/audience.module";
import { RequestModule } from "./nest-modules/request-module/request.module";
import { GamificationModule } from "./nest-modules/gamification-module/gamification.module";
import { PaymentModule } from "./nest-modules/payment-module/payment.module";
import { RabbitmqModule } from "./nest-modules/rabbitmq-module/rabbitmq.module";

@Module({
  imports: [
    // Core Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    ConfigModuleRoot.forRoot(),

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
    DatabaseModule,
    RabbitmqModule,
    SharedModule,

    // Authentication
    AuthModule,

    // Domain Modules
    MusicianModule,
    EstablishmentModule,
    AudienceModule,
    RequestModule,
    GamificationModule,
    PaymentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
