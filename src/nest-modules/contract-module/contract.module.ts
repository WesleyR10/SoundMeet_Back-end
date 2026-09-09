import { Module } from "@nestjs/common";

import { EstablishmentsModule } from "../establishments-module/establishments.module";
import { MailModule } from "../mail-module/mail.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { SchedulingModule } from "../scheduling-module/scheduling.module";
import { CONTRACT_PROVIDERS } from "./contract.providers";
import { ContractDeliveryHandler } from "./contract-delivery.handler";
import { ContractIssuanceHandler } from "./contract-issuance.handler";
import { ContractVerificationController } from "./contract-verification.controller";
import { ContractsController } from "./contracts.controller";

/**
 * Contrato digital de show (F1.3b).
 *
 * **Nó-folha**, como `ReviewsModule`, `NotificationsModule` e
 * `MusicianAnalyticsModule`: importa scheduling, establishments e musicians, e
 * **não é importado por nenhum deles**. O contrato atravessa quatro bounded
 * contexts (booking, estabelecimento, músico/banda, e o seu próprio ledger), e
 * viver dentro de qualquer um deles exigiria importar os outros de volta — o
 * ciclo estático quebra no carregamento (TDZ), antes do NestJS resolver a DI.
 *
 * A emissão é reativa: `ContractIssuanceHandler` escuta `BookingConfirmedEvent`
 * via `@OnEvent`, sem que `scheduling` conheça `contract`.
 */
@Module({
  // MailModule entra pela entrega do código de assinatura (segundo fator).
  imports: [
    SchedulingModule,
    EstablishmentsModule,
    MusiciansModule,
    MailModule,
  ],
  controllers: [ContractsController, ContractVerificationController],
  providers: [
    ContractDeliveryHandler,
    ...Object.values(CONTRACT_PROVIDERS.REPOSITORIES),
    ...Object.values(CONTRACT_PROVIDERS.INFRA),
    ...Object.values(CONTRACT_PROVIDERS.EVENTS),
    ...Object.values(CONTRACT_PROVIDERS.USE_CASES),
    ContractIssuanceHandler,
  ],
  exports: [CONTRACT_PROVIDERS.REPOSITORIES.CONTRACT_REPOSITORY.provide],
})
export class ContractModule {}
