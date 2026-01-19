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

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
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
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: CreateRequestInput): Promise<CreateRequestOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(input.event_id, Event);
    }

    if (event.status !== "active") {
      throw new EntityValidationError([
        {
          event_id: ["Event is not active"],
        },
      ]);
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
    if (!isPerformer) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is not a performer in this event"],
        },
      ]);
    }

    const isAttendee = await this.eventRepo.isAudienceAttendee(
      eventId,
      input.audience_id,
    );
    if (!isAttendee) {
      throw new EntityValidationError([
        {
          audience_id: ["Audience is not an active attendee in this event"],
        },
      ]);
    }

    // Validar limite diário de pedidos por usuário no evento
    const today = new Date();
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

    if (requestsTodayInEvent >= this.maxRequestsPerUserPerEvent) {
      throw new EntityValidationError([
        {
          audience_id: [
            `Daily request limit of ${this.maxRequestsPerUserPerEvent} exceeded for this event`,
          ],
        },
      ]);
    }

    // Verificar se já existe um pedido pendente do mesmo usuário para o mesmo músico
    const pendingRequests =
      await this.requestRepo.findPendingRequestsByAudienceAndMusician(
        input.audience_id,
        input.musician_id,
        input.event_id,
      );
    if (pendingRequests.length > 0) {
      throw new EntityValidationError([
        {
          musician_id: ["You already have a pending request for this musician"],
        },
      ]);
    }

    // Verificar pedidos similares recentes (últimas 2 horas)
    const recentRequests = await this.requestRepo.findRecentRequestsByAudience(
      input.audience_id,
      this.requestCooldownMinutes / 60,
    );

    const tempRequest = Request.create({
      event_id: input.event_id,
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      library_id: input.library_id,
      song_title: input.song_title,
      artist: input.artist,
      message: input.message,
    });

    const hasSimilarRecentRequest = recentRequests.some((request) =>
      tempRequest.isSimilarTo(request),
    );

    if (hasSimilarRecentRequest) {
      throw new EntityValidationError([
        {
          song_title: ["You have already requested this song recently"],
        },
      ]);
    }

    const entity = tempRequest;

    // Remover validação adicional pois o método create já valida
    // if (entity.notification.hasErrors()) {
    //   throw new EntityValidationError(entity.notification.toJSON());
    // }

    await this.requestRepo.insert(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return RequestOutputMapper.toOutput(entity);
  }
}
