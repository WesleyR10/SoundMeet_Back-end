import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { AddPointsUseCase } from "../../core/gamification/application/use-cases/add-points/add-points.use-case";
import { PointsSourceEnum } from "../../core/gamification/domain/value-objects/points-source.vo";
import { RequestAcceptedEvent } from "../../core/request/domain/events/request-accepted.event";
import { RequestCreatedEvent } from "../../core/request/domain/events/request-created.event";
import { RequestPlayedEvent } from "../../core/request/domain/events/request-played.event";
import { RequestRejectedEvent } from "../../core/request/domain/events/request-rejected.event";
import { RequestEventProcessingService } from "./request-event-processing.service";

@Injectable()
export class RequestEventsHandlers {
  private readonly logger = new Logger(RequestEventsHandlers.name);

  constructor(
    @Inject(AddPointsUseCase)
    private readonly addPointsUseCase: AddPointsUseCase,
    private readonly eventProcessing: RequestEventProcessingService,
  ) {}

  @OnEvent(RequestCreatedEvent.name)
  async handleRequestCreated(event: RequestCreatedEvent) {
    try {
      await this.eventProcessing.processOnce(
        `created:${event.aggregate_id.id}:${event.audience_id}`,
        () =>
          this.addPointsUseCase.execute({
            user_id: event.audience_id,
            source: PointsSourceEnum.REQUEST,
            metadata: {
              request_id: event.aggregate_id.id,
              event_id: event.event_id,
              musician_id: event.musician_id,
              song_title: event.song_title,
              artist: event.artist,
            },
          }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "request.created",
          request_id: event.aggregate_id.id,
          audience_id: event.audience_id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  @OnEvent(RequestAcceptedEvent.name)
  async handleRequestAccepted(event: RequestAcceptedEvent) {
    try {
      await this.eventProcessing.processOnce(
        `accepted:${event.aggregate_id.id}:${event.audience_id}`,
        () =>
          this.addPointsUseCase.execute({
            user_id: event.audience_id,
            source: PointsSourceEnum.ACCEPTED_REQUEST,
            metadata: {
              request_id: event.aggregate_id.id,
              event_id: event.event_id,
              musician_id: event.musician_id,
            },
          }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "request.accepted",
          request_id: event.aggregate_id.id,
          audience_id: event.audience_id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  @OnEvent(RequestRejectedEvent.name)
  handleRequestRejected(event: RequestRejectedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "request.rejected",
        request_id: event.aggregate_id.id,
        event_id: event.event_id,
        audience_id: event.audience_id,
        musician_id: event.musician_id,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(RequestPlayedEvent.name)
  async handleRequestPlayed(event: RequestPlayedEvent) {
    try {
      await this.eventProcessing.processOnce(
        `played:${event.aggregate_id.id}:${event.audience_id}`,
        () =>
          this.addPointsUseCase.execute({
            user_id: event.audience_id,
            source: PointsSourceEnum.BONUS,
            metadata: {
              points: 10,
              request_id: event.aggregate_id.id,
              event_id: event.event_id,
              musician_id: event.musician_id,
              description: "Bonus points for a played request",
            },
          }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "request.played",
          request_id: event.aggregate_id.id,
          audience_id: event.audience_id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
