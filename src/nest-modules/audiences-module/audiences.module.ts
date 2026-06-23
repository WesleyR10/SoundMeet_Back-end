import { forwardRef, Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { EventModule } from "../events-module/events.module";
import { GamificationModule } from "../gamification-module/gamification.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentModule } from "../payment-module/payment.module";
import { RequestsModule } from "../requests-module/requests.module";
import { AudiencesController } from "./audiences.controller";
import { AUDIENCES_PROVIDERS } from "./audiences.providers";

@Module({
  imports: [
    DatabaseModule,
    MusiciansModule,
    EventModule,
    GamificationModule,
    PaymentModule,
    forwardRef(() => RequestsModule),
  ],
  controllers: [AudiencesController],
  providers: [
    ...Object.values(AUDIENCES_PROVIDERS.REPOSITORIES),
    ...Object.values(AUDIENCES_PROVIDERS.USE_CASES),
  ],
  exports: [AUDIENCES_PROVIDERS.REPOSITORIES.AUDIENCE_REPOSITORY.provide],
})
export class AudiencesModule {}
