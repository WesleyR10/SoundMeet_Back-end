import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PlansModule } from "../plans-module/plans.module";
import { EstablishmentsController } from "./establishments.controller";
import { ESTABLISHMENTS_PROVIDERS } from "./establishments.providers";

@Module({
  imports: [DatabaseModule, MusiciansModule, PlansModule],
  controllers: [EstablishmentsController],
  providers: [
    ...Object.values(ESTABLISHMENTS_PROVIDERS.REPOSITORIES),
    ...Object.values(ESTABLISHMENTS_PROVIDERS.SERVICES),
    ...Object.values(ESTABLISHMENTS_PROVIDERS.STORAGE),
    ...Object.values(ESTABLISHMENTS_PROVIDERS.EVENTS),
    ...Object.values(ESTABLISHMENTS_PROVIDERS.USE_CASES),
    ...Object.values(ESTABLISHMENTS_PROVIDERS.HANDLERS),
    ...Object.values(ESTABLISHMENTS_PROVIDERS.JOBS),
  ],
  exports: [
    ESTABLISHMENTS_PROVIDERS.REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide,
  ],
})
export class EstablishmentsModule {}
