import { Module } from "@nestjs/common";

import { AudiencesModule } from "../audiences-module/audiences.module";
import { ChatModule } from "../chat-module/chat.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PaymentModule } from "../payment-module/payment.module";
import { NotificationsChatEventsHandler } from "./chat-message-events.handler";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsPaymentEventsHandler } from "./payment-events.handler";
import { PushNotificationService } from "./push-notification.service";
import { RequestEventsHandler } from "./request-events.handler";

@Module({
  imports: [MusiciansModule, AudiencesModule, PaymentModule, ChatModule],
  providers: [
    NotificationsGateway,
    RequestEventsHandler,
    NotificationsPaymentEventsHandler,
    NotificationsChatEventsHandler,
    PushNotificationService,
  ],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
