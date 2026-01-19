import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type GetEventInput = {
  establishment_id: string;
  event_id: string;
};

export class GetEventUseCase implements IUseCase<GetEventInput, EventOutput> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: GetEventInput): Promise<EventOutput> {
    const eventId = new EventId(input.event_id);
    const entity = await this.eventRepo.findById(eventId);
    if (!entity || entity.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }
    return EventOutputMapper.toOutput(entity);
  }
}
