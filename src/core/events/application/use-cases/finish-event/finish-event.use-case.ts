import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type FinishEventInput = {
  establishment_id: string;
  event_id: string;
};

export class FinishEventUseCase implements IUseCase<
  FinishEventInput,
  EventOutput
> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: FinishEventInput): Promise<EventOutput> {
    const eventId = new EventId(input.event_id);
    const entity = await this.eventRepo.findById(eventId);

    if (!entity || entity.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    entity.finish();
    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.eventRepo.update(entity);
    return EventOutputMapper.toOutput(entity);
  }
}
