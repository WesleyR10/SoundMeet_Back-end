import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";

export type AddEventPerformerInput = {
  establishment_id: string;
  event_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  fee?: number | null;
  status?: string;
  start_at?: Date | null;
  end_at?: Date | null;
};

export type AddEventPerformerOutput = void;

export class AddEventPerformerUseCase implements IUseCase<
  AddEventPerformerInput,
  AddEventPerformerOutput
> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(
    input: AddEventPerformerInput,
  ): Promise<AddEventPerformerOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    try {
      await this.eventRepo.addPerformer(eventId, {
        musician_id: input.musician_id,
        band_id: input.band_id,
        fee: input.fee,
        status: input.status,
        start_at: input.start_at,
        end_at: input.end_at,
      });
    } catch (e: any) {
      if (e instanceof InvalidArgumentError) {
        throw new EntityValidationError([{ performer: [e.message] }]);
      }
      throw e;
    }
  }
}
