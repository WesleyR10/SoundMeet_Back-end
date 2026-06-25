import { ForbiddenException } from "@nestjs/common";

import { Event, EventId, IEventRepository } from "../../../../events/domain";
import {
  IMusicianRepository,
  Musician,
  MusicianId,
} from "../../../../musician/domain";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { MarkRequestPlayedInput } from "./mark-request-played.input";

export type MarkRequestPlayedOutput = RequestOutput;

export class MarkRequestPlayedUseCase implements IUseCase<
  MarkRequestPlayedInput,
  MarkRequestPlayedOutput
> {
  constructor(
    private requestRepo: IRequestRepository,
    private eventRepo: IEventRepository,
    private musicianRepo: IMusicianRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(
    input: MarkRequestPlayedInput,
  ): Promise<MarkRequestPlayedOutput> {
    const requestId = new RequestId(input.request_id);
    const entity = await this.requestRepo.findById(requestId);

    if (!entity) {
      throw new NotFoundError(input.request_id, Request);
    }

    if (input.musician_id && entity.musician_id.id !== input.musician_id) {
      throw new ForbiddenException(
        "Você não tem permissão para marcar este pedido como tocado.",
      );
    }

    await this.validateEventAndMusician(
      entity.event_id.id,
      entity.musician_id.id,
    );

    const playedAt = input.played_at
      ? new Date(input.played_at)
      : this.clock.now();
    entity.markAsPlayed(playedAt);

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.requestRepo.update(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return RequestOutputMapper.toOutput(entity);
  }

  private async validateEventAndMusician(
    event_id: string,
    musician_id: string,
  ): Promise<void> {
    const eventId = new EventId(event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(event_id, Event);
    }

    if (event.status !== "active") {
      throw new EntityValidationError([
        {
          event_id: ["Event is not active"],
        },
      ]);
    }

    const musicianId = new MusicianId(musician_id);
    const musician = await this.musicianRepo.findById(musicianId);
    if (!musician) {
      throw new NotFoundError(musician_id, Musician);
    }

    musician.ensureIsActive();
    if (musician.notification.hasErrors()) {
      throw new EntityValidationError(musician.notification.toJSON());
    }

    const isPerformer = await this.eventRepo.isMusicianPerformer(
      eventId,
      musician_id,
    );
    if (!isPerformer) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is not a performer in this event"],
        },
      ]);
    }
  }
}
