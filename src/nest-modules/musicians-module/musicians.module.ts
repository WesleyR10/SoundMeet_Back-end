import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { PlansModule } from "../plans-module/plans.module";
import { BandsController } from "./bands.controller";
import { MusiciansController } from "./musicians.controller";
import { MUSICIANS_PROVIDERS } from "./musicians.providers";

@Module({
  imports: [DatabaseModule, PlansModule],
  controllers: [MusiciansController, BandsController],
  providers: [
    ...Object.values(MUSICIANS_PROVIDERS.REPOSITORIES),
    ...Object.values(MUSICIANS_PROVIDERS.STORAGE),
    ...Object.values(MUSICIANS_PROVIDERS.SERVICES),
    ...Object.values(MUSICIANS_PROVIDERS.EVENTS),
    ...Object.values(MUSICIANS_PROVIDERS.USE_CASES),
  ],
  exports: [
    MUSICIANS_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide,
    MUSICIANS_PROVIDERS.REPOSITORIES.BAND_REPOSITORY.provide,
  ],
})
export class MusiciansModule {}
