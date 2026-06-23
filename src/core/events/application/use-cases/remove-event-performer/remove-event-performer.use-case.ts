import {
  Event,
  EventId,
  EventMusician,
  EventMusicianId,
  IEventMusicianRepository,
  IEventRepository,
} from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";

export type RemoveEventPerformerInput = {
  establishment_id: string;
  event_id: string;
  event_musician_id: string;
};

export type RemoveEventPerformerOutput = void;

export class RemoveEventPerformerUseCase implements IUseCase<
  RemoveEventPerformerInput,
  RemoveEventPerformerOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
  ) {}

  async execute(
    input: RemoveEventPerformerInput,
  ): Promise<RemoveEventPerformerOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    const eventMusicianId = new EventMusicianId(input.event_musician_id);
    const performer = await this.eventMusicianRepo.findById(eventMusicianId);
    if (!performer || performer.event_id.id !== input.event_id) {
      throw new NotFoundError(input.event_musician_id, EventMusician);
    }

    await this.eventMusicianRepo.delete(eventMusicianId);
  }
}
