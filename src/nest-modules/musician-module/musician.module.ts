import { Module } from "@nestjs/common";
import { MusicianController } from "./musician.controller";
import { MUSICIAN_PROVIDERS } from "./musician.providers";
import { DatabaseModule } from "../database-module/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [MusicianController],
  providers: [
    ...Object.values(MUSICIAN_PROVIDERS.REPOSITORIES),
    ...Object.values(MUSICIAN_PROVIDERS.USE_CASES),
    ...Object.values(MUSICIAN_PROVIDERS.VALIDATIONS),
  ],
  exports: [MUSICIAN_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide],
})
export class MusicianModule {}
