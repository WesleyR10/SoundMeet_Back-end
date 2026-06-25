import { Event, EventId, IEventRepository } from "../../../../events/domain";
import {
  IMusicianRepository,
  Musician,
  MusicianId,
} from "../../../../musician/domain";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request } from "../../../domain/request.aggregate";
import { RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { UpdateRequestInput } from "./update-request.input";

export class UpdateRequestUseCase implements IUseCase<
  UpdateRequestInput,
  UpdateRequestOutput
> {
  constructor(
    private readonly requestRepo: IRequestRepository,
    private readonly eventRepo: IEventRepository,
    private readonly musicianRepo: IMusicianRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: UpdateRequestInput): Promise<RequestOutput> {
    const entity = await this.requestRepo.findById(new RequestId(input.id));
    if (!entity) {
      throw new NotFoundError(input.id, Request);
    }

    if (
      input.requesting_audience_id !== undefined &&
      entity.audience_id.id !== input.requesting_audience_id
    ) {
      throw new InvalidOperationError(
        "You do not have permission to update this request",
      );
    }

    await this.validateEventAndMusician(
      entity.event_id.id,
      entity.musician_id.id,
    );

    if (input.song_title !== undefined) {
      entity.changeSongTitle(input.song_title);
    }

    if (input.artist !== undefined) {
      entity.changeArtist(input.artist);
    }

    if (input.message !== undefined) {
      entity.changeMessage(input.message);
    }

    entity.validate();

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

export type UpdateRequestOutput = RequestOutput;
