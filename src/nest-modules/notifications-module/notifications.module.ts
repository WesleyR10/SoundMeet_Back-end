import { Module } from "@nestjs/common";

import { NotificationsGateway } from "./notifications.gateway";
import { RequestEventsHandler } from "./request-events.handler";

@Module({
  providers: [NotificationsGateway, RequestEventsHandler],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
