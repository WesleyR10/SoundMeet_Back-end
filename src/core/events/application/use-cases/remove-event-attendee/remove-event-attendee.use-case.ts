import {
  Event,
  EventId,
  IEventAttendeeRepository,
  IEventRepository,
} from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Uuid } from "../../../../shared/domain";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type RemoveEventAttendeeInput = {
  establishment_id: string;
  event_id: string;
  audience_id: string;
};

export class RemoveEventAttendeeUseCase implements IUseCase<
  RemoveEventAttendeeInput,
  EventOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventAttendeeRepo: IEventAttendeeRepository,
  ) {}

  async execute(input: RemoveEventAttendeeInput): Promise<EventOutput> {
    const eventId = new EventId(input.event_id);
    const eventFound = await this.eventRepo.findById(eventId);
    if (
      !eventFound ||
      eventFound.establishment_id.id !== input.establishment_id
    ) {
      throw new NotFoundError(input.event_id, Event);
    }

    const attendeeRepo = this.eventAttendeeRepo;
    const eventUuid = new Uuid(eventId.id);
    const audienceUuid = new Uuid(input.audience_id);
    const now = new Date();

    const existing = await attendeeRepo.findByEventAndAudience(
      eventUuid,
      audienceUuid,
    );

    if (!existing) {
      throw new NotFoundError(input.audience_id, Event);
    }

    // Idempotency: an inactive attendance does not change capacity again.
    if (!existing.isActive) {
      const current = await this.eventRepo.findById(eventId);
      return EventOutputMapper.toOutput(current!);
    }

    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(input.event_id, Event);
    }

    event.removeAttendee(input.audience_id, now);
    if (event.notification.hasErrors()) {
      throw new EntityValidationError(event.notification.toJSON());
    }

    existing.leave(now);
    if (existing.notification.hasErrors()) {
      throw new EntityValidationError(existing.notification.toJSON());
    }

    await attendeeRepo.update(existing);
    await this.eventRepo.update(event);
    return EventOutputMapper.toOutput(event);
  }
}
