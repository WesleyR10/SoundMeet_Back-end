import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { RequestAcceptedEvent } from "../../core/request/domain/events/request-accepted.event";
import { RequestRejectedEvent } from "../../core/request/domain/events/request-rejected.event";
import { NotificationsGateway } from "./notifications.gateway";

@Injectable()
export class RequestEventsHandler {
  private readonly logger = new Logger(RequestEventsHandler.name);

  constructor(private readonly gateway: NotificationsGateway) {}

  @OnEvent(RequestAcceptedEvent.name)
  handleRequestAccepted(event: RequestAcceptedEvent): void {
    this.logger.debug(
      `Handling RequestAcceptedEvent for audience=${event.audience_id}`,
    );
    this.gateway.notifyRequestStatusChanged(event.audience_id, {
      request_id: event.request_id.id,
      status: "accepted",
      musician_id: event.musician_id,
      song_title: event.song_title,
      occurred_at: event.occurred_on.toISOString(),
    });
  }

  @OnEvent(RequestRejectedEvent.name)
  handleRequestRejected(event: RequestRejectedEvent): void {
    this.logger.debug(
      `Handling RequestRejectedEvent for audience=${event.audience_id}`,
    );
    this.gateway.notifyRequestStatusChanged(event.audience_id, {
      request_id: event.request_id.id,
      status: "rejected",
      musician_id: event.musician_id,
      song_title: event.song_title,
      rejection_reason: event.rejection_reason,
      occurred_at: event.occurred_on.toISOString(),
    });
  }
}
