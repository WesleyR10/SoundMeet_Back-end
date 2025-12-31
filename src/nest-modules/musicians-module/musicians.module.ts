import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { BandsController } from "./bands.controller";
import { MusiciansController } from "./musicians.controller";
import { MUSICIANS_PROVIDERS } from "./musicians.providers";

@Module({
  imports: [DatabaseModule],
  controllers: [MusiciansController, BandsController],
  providers: [
    ...Object.values(MUSICIANS_PROVIDERS.REPOSITORIES),
    ...Object.values(MUSICIANS_PROVIDERS.USE_CASES),
  ],
  exports: [
    MUSICIANS_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide,
    MUSICIANS_PROVIDERS.REPOSITORIES.BAND_REPOSITORY.provide,
  ],
})
export class MusiciansModule {}
