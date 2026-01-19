import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { GamificationController } from "./gamification.controller";
import { GAMIFICATION_PROVIDERS } from "./gamification.providers";

@Module({
  imports: [DatabaseModule],
  controllers: [GamificationController],
  providers: [
    ...Object.values(GAMIFICATION_PROVIDERS.REPOSITORIES),
    ...Object.values(GAMIFICATION_PROVIDERS.USE_CASES),
  ],
})
export class GamificationModule {}
