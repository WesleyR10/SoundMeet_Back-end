import { Module } from "@nestjs/common";

import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentModule } from "../payment-module/payment.module";
import { PlansModule } from "../plans-module/plans.module";
import { RequestsModule } from "../requests-module/requests.module";
import { MusicianAnalyticsController } from "./musician-analytics.controller";
import { MUSICIAN_ANALYTICS_PROVIDERS } from "./musician-analytics.providers";

// Módulo orquestrador — composição somente-leitura sobre 3 bounded contexts
// (musician/request/payment) para o endpoint GET /musicians/:id/analytics.
// Não vive dentro de MusiciansModule porque precisaria importar RequestsModule
// e PaymentModule de volta, criando um ciclo estático de import de 3 saltos
// (Musicians -> Requests -> Audiences -> Musicians, via forwardRef existente
// entre Requests/Audiences) que quebra no carregamento do módulo (TDZ) antes
// mesmo do NestJS resolver a árvore de DI — forwardRef só adia o uso do
// binding, não a instrução de import em si. Mesmo padrão de módulo agregador
// já usado por NotificationsModule (importa Musicians+Audiences+Payment sem
// forwardRef, como nó-folha sem aresta de volta).
@Module({
  imports: [MusiciansModule, RequestsModule, PaymentModule, PlansModule],
  controllers: [MusicianAnalyticsController],
  providers: [...Object.values(MUSICIAN_ANALYTICS_PROVIDERS.USE_CASES)],
})
export class MusicianAnalyticsModule {}
