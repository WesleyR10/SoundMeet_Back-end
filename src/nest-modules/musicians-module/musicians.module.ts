import { Module } from "@nestjs/common";
import { MusiciansController } from "./musicians.controller";
import { DatabaseModule } from "../database-module/database.module";
import { MUSICIANS_PROVIDERS } from "./musicians.providers";

@Module({
  imports: [DatabaseModule],
  controllers: [MusiciansController],
  providers: [
    ...Object.values(MUSICIANS_PROVIDERS.REPOSITORIES),
    ...Object.values(MUSICIANS_PROVIDERS.USE_CASES),
  ],
  exports: [MUSICIANS_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide],
})
export class MusiciansModule {}
