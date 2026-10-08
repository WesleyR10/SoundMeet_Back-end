import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type CancelEventInput = {
  establishment_id: string;
  event_id: string;
};

export class CancelEventUseCase implements IUseCase<
  CancelEventInput,
  EventOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    /** Publica `EventCancelledEvent` — avisa quem soube do show pelos seguidores. */
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: CancelEventInput): Promise<EventOutput> {
    const eventId = new EventId(input.event_id);
    const entity = await this.eventRepo.findById(eventId);

    if (!entity || entity.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    entity.cancel(new Date());
    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.eventRepo.update(entity);
    await this.domainEventMediator?.publish(entity);
    return EventOutputMapper.toOutput(entity);
  }
}
