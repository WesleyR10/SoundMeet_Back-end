import {
  Event,
  EventId,
  EventMusicianId,
  IEventMusicianRepository,
  IEventRepository,
} from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";

export type RemoveEventMusicianInput = {
  establishment_id: string;
  event_id: string;
  event_musician_id: string;
};

export type RemoveEventMusicianOutput = void;

export class RemoveEventMusicianUseCase implements IUseCase<
  RemoveEventMusicianInput,
  RemoveEventMusicianOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
  ) {}

  async execute(
    input: RemoveEventMusicianInput,
  ): Promise<RemoveEventMusicianOutput> {
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

    await this.eventMusicianRepo.delete(eventMusicianId);
  }
}
