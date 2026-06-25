import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";

export type DeleteEventInput = {
  establishment_id: string;
  event_id: string;
};

export type DeleteEventOutput = void;

export class DeleteEventUseCase implements IUseCase<
  DeleteEventInput,
  DeleteEventOutput
> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: DeleteEventInput): Promise<DeleteEventOutput> {
    const eventId = new EventId(input.event_id);
    const entity = await this.eventRepo.findById(eventId);
    if (!entity || entity.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }
    if (entity.status === "active" || entity.status === "completed") {
      throw new InvalidOperationError(
        `Cannot delete an event with status '${entity.status}'. Only scheduled or cancelled events can be deleted.`,
      );
    }
    await this.eventRepo.delete(eventId);
  }
}
