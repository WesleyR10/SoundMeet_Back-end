import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { MusicianId } from "../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { RequestAcceptedEvent } from "../../core/request/domain/events/request-accepted.event";
import { RequestCreatedEvent } from "../../core/request/domain/events/request-created.event";
import { RequestRejectedEvent } from "../../core/request/domain/events/request-rejected.event";
import { NotificationsGateway } from "./notifications.gateway";
import { PushNotificationService } from "./push-notification.service";

@Injectable()
export class RequestEventsHandler {
  private readonly logger = new Logger(RequestEventsHandler.name);

  constructor(
    private readonly gateway: NotificationsGateway,
    @Inject("MusicianRepository")
    private readonly musicianRepo: IMusicianRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

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

  @OnEvent(RequestCreatedEvent.name)
  async handleRequestCreated(event: RequestCreatedEvent): Promise<void> {
    this.logger.debug(
      `Handling RequestCreatedEvent for musician=${event.musician_id}`,
    );

    this.gateway.notifyNewRequest(event.musician_id, {
      request_id: event.aggregate_id.id,
      event_id: event.event_id,
      audience_id: event.audience_id,
      musician_id: event.musician_id,
      song_title: event.song_title,
      artist: event.artist,
      message: event.message,
      occurred_at: event.occurred_on.toISOString(),
    });

    try {
      const musician = await this.musicianRepo.findById(
        new MusicianId(event.musician_id),
      );

      if (musician?.push_token) {
        await this.pushNotificationService.send(musician.push_token, {
          title: "Novo pedido 🎵",
          body: event.artist
            ? `${event.song_title} — ${event.artist}`
            : event.song_title,
          data: { type: "request.created", request_id: event.aggregate_id.id },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send push notification for request=${event.aggregate_id.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
