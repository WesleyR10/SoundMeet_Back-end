import { Module } from "@nestjs/common";
import { EstablishmentController } from "./establishment.controller";
import { ESTABLISHMENT_PROVIDERS } from "./establishment.providers";
import { DatabaseModule } from "../database-module/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [EstablishmentController],
  providers: [
    ...Object.values(ESTABLISHMENT_PROVIDERS.REPOSITORIES),
    ...Object.values(ESTABLISHMENT_PROVIDERS.USE_CASES),
  ],
  exports: [
    ESTABLISHMENT_PROVIDERS.REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide,
    ...Object.values(ESTABLISHMENT_PROVIDERS.USE_CASES),
  ],
})
export class EstablishmentModule {}
