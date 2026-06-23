import {
  Audience,
  AudienceId,
  IAudienceRepository,
} from "@core/audience/domain";
import { Event, EventId, IEventRepository } from "@core/events/domain";
import {
  IMusicianRepository,
  Musician,
  MusicianId,
} from "@core/musician/domain";

import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { CanMakeRequestPolicy } from "../../../domain/policies/can-make-request.policy";
import { Request } from "../../../domain/request.aggregate";
import {
  IRequestRepository,
  RequestSearchParams,
} from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { CreateRequestInput } from "./create-request.input";

export type CreateRequestOutput = RequestOutput;

export class CreateRequestUseCase implements IUseCase<
  CreateRequestInput,
  CreateRequestOutput
> {
  constructor(
    private requestRepo: IRequestRepository,
    private eventRepo: IEventRepository,
    private musicianRepo: IMusicianRepository,
    private audienceRepo: IAudienceRepository,
    private readonly maxRequestsPerUserPerEvent: number,
    private readonly requestCooldownMinutes: number,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: CreateRequestInput): Promise<CreateRequestOutput> {
    const now = this.clock.now();
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(input.event_id, Event);
    }

    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);
    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    musician.ensureIsActive();
    if (musician.notification.hasErrors()) {
      throw new EntityValidationError(musician.notification.toJSON());
    }

    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepo.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    const isPerformer = await this.eventRepo.isMusicianPerformer(
      eventId,
      input.musician_id,
    );

    const isAttendee = await this.eventRepo.isAudienceAttendee(
      eventId,
      input.audience_id,
    );

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const requestsTodayInEvent =
      await this.requestRepo.countRequestsByAudienceInPeriodForEvent(
        input.audience_id,
        input.event_id,
        today,
        tomorrow,
      );

    const pendingRequests =
      await this.requestRepo.findPendingRequestsByAudienceAndMusician(
        input.audience_id,
        input.musician_id,
        input.event_id,
      );
    const hasPendingRequestForMusician = pendingRequests.length > 0;

    const cooldownHours = this.requestCooldownMinutes / 60;
    const cooldownSince = new Date(
      now.getTime() - cooldownHours * 60 * 60 * 1000,
    );
    const recentRequestsResult = await this.requestRepo.search(
      RequestSearchParams.create({
        filter: {
          audience_id: input.audience_id,
          created_after: cooldownSince,
        },
        sort: "created_at",
        sort_dir: "desc",
      }),
    );
    const recentRequests = recentRequestsResult.items;

    const candidate = Request.create({
      event_id: input.event_id,
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      library_id: input.library_id,
      song_title: input.song_title,
      artist: input.artist,
      message: input.message,
    });

    const policy = new CanMakeRequestPolicy();
    const policyResult = policy.evaluate({
      event_status: event.status,
      is_musician_performer: isPerformer,
      is_audience_attendee: isAttendee,
      requests_today_in_event: requestsTodayInEvent,
      max_requests_per_user_per_event: this.maxRequestsPerUserPerEvent,
      has_pending_request_for_musician: hasPendingRequestForMusician,
      recent_requests: recentRequests,
      candidate,
    });

    if (!policyResult.isValid) {
      throw new EntityValidationError(policyResult.errors);
    }

    const entity = candidate;

    await this.requestRepo.insert(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return RequestOutputMapper.toOutput(entity);
  }
}
