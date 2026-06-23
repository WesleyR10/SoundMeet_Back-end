import {
  Event,
  EventId,
  EventMusicianId,
  IEventMusicianRepository,
  IEventRepository,
} from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  EventMusicianOutput,
  EventMusicianOutputMapper,
} from "../common/event-musician-output";

export type UpdateEventMusicianStatusAction = "confirm" | "cancel";

export type UpdateEventMusicianStatusInput = {
  establishment_id: string;
  event_id: string;
  event_musician_id: string;
  action: UpdateEventMusicianStatusAction;
};

export class UpdateEventMusicianStatusUseCase implements IUseCase<
  UpdateEventMusicianStatusInput,
  EventMusicianOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
  ) {}

  async execute(
    input: UpdateEventMusicianStatusInput,
  ): Promise<EventMusicianOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    const eventMusicianId = new EventMusicianId(input.event_musician_id);
    const eventMusician =
      await this.eventMusicianRepo.findById(eventMusicianId);
    if (!eventMusician || eventMusician.event_id.id !== input.event_id) {
      throw new NotFoundError(input.event_musician_id, Event);
    }

    if (input.action === "confirm") {
      eventMusician.confirm();
    } else {
      eventMusician.cancel();
    }

    if (eventMusician.notification.hasErrors()) {
      throw new EntityValidationError(eventMusician.notification.toJSON());
    }

    await this.eventMusicianRepo.update(eventMusician);
    return EventMusicianOutputMapper.toOutput(eventMusician);
  }
}
