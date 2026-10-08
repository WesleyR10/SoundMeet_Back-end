import { Module } from "@nestjs/common";

import { AuthModule } from "../auth-module/auth.module";
import { DatabaseModule } from "../database-module/database.module";
import { EstablishmentsModule } from "../establishments-module/establishments.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { AudienceFollowsController } from "./audience-follows.controller";
import { FOLLOW_PROVIDERS } from "./follows.providers";
import { FollowsSummaryController } from "./follows-summary.controller";

/**
 * Seguir músico/casa (Bloco 19.B).
 *
 * Quase-folha: importa Musicians/Establishments (para validar e enriquecer o
 * alvo) e exporta o repositório para o `notifications-module`, que é quem
 * avisa os seguidores. Nenhum módulo de domínio importa este.
 */
@Module({
  imports: [DatabaseModule, AuthModule, MusiciansModule, EstablishmentsModule],
  controllers: [AudienceFollowsController, FollowsSummaryController],
  providers: [
    ...Object.values(FOLLOW_PROVIDERS.REPOSITORIES),
    ...Object.values(FOLLOW_PROVIDERS.SERVICES),
    ...Object.values(FOLLOW_PROVIDERS.USE_CASES),
  ],
  exports: [FOLLOW_PROVIDERS.REPOSITORIES.FOLLOW_REPOSITORY.provide],
})
export class FollowsModule {}
