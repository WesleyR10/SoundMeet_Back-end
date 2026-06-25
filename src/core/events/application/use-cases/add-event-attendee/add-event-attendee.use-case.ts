import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type AddEventAttendeeInput = {
  establishment_id: string;
  event_id: string;
  audience_id: string;
};

export class AddEventAttendeeUseCase implements IUseCase<
  AddEventAttendeeInput,
  EventOutput
> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: AddEventAttendeeInput): Promise<EventOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    await this.eventRepo.addAttendee(eventId, input.audience_id, new Date());

    const updated = await this.eventRepo.findById(eventId);
    return EventOutputMapper.toOutput(updated!);
  }
}
