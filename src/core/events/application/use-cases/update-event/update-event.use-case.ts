import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";
import { UpdateEventInput } from "./update-event.input";

export class UpdateEventUseCase implements IUseCase<
  UpdateEventInput,
  EventOutput
> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: UpdateEventInput): Promise<EventOutput> {
    const eventId = new EventId(input.id);
    const entity = await this.eventRepo.findById(eventId);

    if (!entity || entity.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.id, Event);
    }

    entity.update(
      {
        name: input.name,
        description: input.description,
        start_at: input.start_at,
        end_at: input.end_at,
        max_capacity: input.max_capacity,
        is_public: input.is_public,
        cover_charge: input.cover_charge,
      },
      new Date(),
    );

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.eventRepo.update(entity);
    return EventOutputMapper.toOutput(entity);
  }
}
