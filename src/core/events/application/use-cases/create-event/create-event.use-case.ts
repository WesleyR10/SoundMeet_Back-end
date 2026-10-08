import { Event, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";
import { CreateEventInput } from "./create-event.input";

export class CreateEventUseCase implements IUseCase<
  CreateEventInput,
  EventOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    /** Publica `EventCreatedEvent` — "show anunciado" para quem segue a casa. */
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: CreateEventInput): Promise<EventOutput> {
    const entity = Event.create({
      establishment_id: input.establishment_id,
      name: input.name,
      description: input.description,
      start_at: input.start_at,
      end_at: input.end_at,
      max_capacity: input.max_capacity ?? null,
      is_public: input.is_public,
      cover_charge: input.cover_charge ?? null,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.eventRepo.insert(entity);
    await this.domainEventMediator?.publish(entity);
    return EventOutputMapper.toOutput(entity);
  }
}
