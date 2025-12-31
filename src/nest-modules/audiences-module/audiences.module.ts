import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { AudiencesController } from "./audiences.controller";
import { AUDIENCES_PROVIDERS } from "./audiences.providers";

@Module({
  imports: [DatabaseModule, MusiciansModule],
  controllers: [AudiencesController],
  providers: [
    ...Object.values(AUDIENCES_PROVIDERS.REPOSITORIES),
    ...Object.values(AUDIENCES_PROVIDERS.USE_CASES),
  ],
  exports: [AUDIENCES_PROVIDERS.REPOSITORIES.AUDIENCE_REPOSITORY.provide],
})
export class AudiencesModule {}
