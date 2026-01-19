import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  Audience,
  AudienceId,
  IAudienceRepository,
} from "../../core/audience/domain";
import { RequestAcceptedEvent } from "../../core/request/domain/events/request-accepted.event";
import { RequestCreatedEvent } from "../../core/request/domain/events/request-created.event";
import { RequestPlayedEvent } from "../../core/request/domain/events/request-played.event";
import { RequestRejectedEvent } from "../../core/request/domain/events/request-rejected.event";
import {
  IRequestRepository,
  RequestSearchParams,
} from "../../core/request/domain/request.repository";
import { NotFoundError } from "../../core/shared/domain/errors/not-found.error";

@Injectable()
export class RequestEventsHandlers {
  private readonly logger = new Logger(RequestEventsHandlers.name);

  constructor(
    @Inject("AudienceRepository")
    private readonly audienceRepo: IAudienceRepository,
    @Inject("RequestRepository")
    private readonly requestRepo: IRequestRepository,
  ) {}

  @OnEvent(RequestCreatedEvent.name)
  async handleRequestCreated(event: RequestCreatedEvent) {
    try {
      const audience = await this.audienceRepo.findById(
        new AudienceId(event.audience_id),
      );
      if (!audience) {
        throw new NotFoundError(event.audience_id, Audience);
      }

      audience.makeMusicRequest(
        event.musician_id,
        event.song_title,
        event.artist ?? "",
        event.event_id,
      );

      if (!audience.getBadges().includes("Sugestor")) {
        audience.addBadge("Sugestor");
      }

      await this.audienceRepo.update(audience);
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
  handleRequestAccepted(event: RequestAcceptedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "request.accepted",
        request_id: event.aggregate_id.id,
        event_id: event.event_id,
        audience_id: event.audience_id,
        musician_id: event.musician_id,
        occurred_on: event.occurred_on,
      }),
    );
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
      const audience = await this.audienceRepo.findById(
        new AudienceId(event.audience_id),
      );
      if (!audience) {
        throw new NotFoundError(event.audience_id, Audience);
      }

      audience.addPointsForAction("correct_guess");

      const playedCount = (
        await this.requestRepo.search(
          RequestSearchParams.create({
            page: 1,
            per_page: 1,
            filter: {
              audience_id: event.audience_id,
              status: "played",
            },
          }),
        )
      ).total;

      if (playedCount >= 5 && !audience.getBadges().includes("Acertador")) {
        audience.addBadge("Acertador");
      }

      await this.audienceRepo.update(audience);
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
