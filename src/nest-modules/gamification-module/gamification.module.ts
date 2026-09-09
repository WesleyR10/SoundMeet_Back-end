import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { GamificationTipCompletedConsumer } from "./gamification.consumers";
import { GamificationController } from "./gamification.controller";
import { GAMIFICATION_PROVIDERS } from "./gamification.providers";

@Module({
  imports: [DatabaseModule],
  controllers: [GamificationController],
  providers: [
    ...Object.values(GAMIFICATION_PROVIDERS.REPOSITORIES),
    ...Object.values(GAMIFICATION_PROVIDERS.USE_CASES),
    ...((process.env.GAMIFICATION_PROCESSING_TRANSPORT ?? "inline") ===
    "rabbitmq"
      ? [GamificationTipCompletedConsumer]
      : []),
  ],
  exports: [
    GAMIFICATION_PROVIDERS.REPOSITORIES.USER_POINTS_REPOSITORY.provide,
    GAMIFICATION_PROVIDERS.REPOSITORIES.USER_SCORE_REPOSITORY.provide,
    GAMIFICATION_PROVIDERS.USE_CASES.ADD_POINTS_USE_CASE.provide,
    GAMIFICATION_PROVIDERS.USE_CASES.CALCULATE_POINTS_USE_CASE.provide,
    GAMIFICATION_PROVIDERS.USE_CASES.CALCULATE_RANKING_USE_CASE.provide,
  ],
})
export class GamificationModule {}
