import { Module } from "@nestjs/common";

import { AuthModule } from "../auth-module/auth.module";
import { DatabaseModule } from "../database-module/database.module";
import { EstablishmentIndicationsController } from "./establishment-indications.controller";
import { INDICATION_PROVIDERS } from "./indications.providers";

/**
 * Indicação de talentos.
 *
 * Nó-folha de propósito: nada aqui importa outro módulo de domínio, e o
 * `RecordIndicationUseCase` é EXPORTADO para que o `audiences-module` o consuma
 * a partir do handler de `MusicianIndicatedEvent` — a direção da dependência é
 * audiences → indication, nunca o contrário.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [EstablishmentIndicationsController],
  providers: [
    ...Object.values(INDICATION_PROVIDERS.REPOSITORIES),
    ...Object.values(INDICATION_PROVIDERS.USE_CASES),
  ],
  exports: [
    INDICATION_PROVIDERS.REPOSITORIES.INDICATION_REPOSITORY.provide,
    INDICATION_PROVIDERS.USE_CASES.RECORD_INDICATION_USE_CASE.provide,
  ],
})
export class IndicationsModule {}
