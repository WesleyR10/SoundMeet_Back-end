import { Module } from "@nestjs/common";

import { AudiencesModule } from "../audiences-module/audiences.module";
import { ChatModule } from "../chat-module/chat.module";
import { EstablishmentsModule } from "../establishments-module/establishments.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentModule } from "../payment-module/payment.module";
import { SchedulingModule } from "../scheduling-module/scheduling.module";
import { NotificationsChatEventsHandler } from "./chat-message-events.handler";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsPaymentEventsHandler } from "./payment-events.handler";
import { PushNotificationService } from "./push-notification.service";
import { RequestEventsHandler } from "./request-events.handler";
import { NotificationsSchedulingEventsHandler } from "./scheduling-events.handler";

@Module({
  // Nó-folha: importa os módulos de domínio e NUNCA é importado por eles —
  // é o que permite acumular contextos aqui sem criar ciclo estático.
  // Scheduling + Establishments entraram no Bloco 9.5 (notificações de agenda).
  imports: [
    MusiciansModule,
    AudiencesModule,
    PaymentModule,
    ChatModule,
    SchedulingModule,
    EstablishmentsModule,
  ],
  providers: [
    NotificationsGateway,
    RequestEventsHandler,
    NotificationsPaymentEventsHandler,
    NotificationsChatEventsHandler,
    NotificationsSchedulingEventsHandler,
    PushNotificationService,
  ],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
