import {
  Event,
  EventId,
  EventMusician,
  EventMusicianStatus,
  IEventMusicianRepository,
  IEventRepository,
} from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";

export type AddEventPerformerInput = {
  establishment_id: string;
  event_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  fee?: number | null;
  status?: EventMusicianStatus;
  start_at?: Date | null;
  end_at?: Date | null;
};

export type AddEventPerformerOutput = void;

export class AddEventPerformerUseCase implements IUseCase<
  AddEventPerformerInput,
  AddEventPerformerOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
  ) {}

  async execute(
    input: AddEventPerformerInput,
  ): Promise<AddEventPerformerOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    const performer = EventMusician.create({
      event_id: input.event_id,
      musician_id: input.musician_id ?? null,
      band_id: input.band_id ?? null,
      fee: input.fee ?? null,
      status: input.status ?? "confirmed",
      start_at: input.start_at ?? null,
      end_at: input.end_at ?? null,
    });

    if (performer.notification.hasErrors()) {
      throw new EntityValidationError(performer.notification.toJSON());
    }

    await this.eventMusicianRepo.insert(performer);
  }
}
