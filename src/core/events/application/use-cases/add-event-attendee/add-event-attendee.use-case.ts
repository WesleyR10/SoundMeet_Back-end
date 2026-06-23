import {
  Event,
  EventAttendee,
  EventId,
  IEventAttendeeRepository,
  IEventRepository,
} from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Uuid } from "../../../../shared/domain";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
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
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventAttendeeRepo: IEventAttendeeRepository,
  ) {}

  async execute(input: AddEventAttendeeInput): Promise<EventOutput> {
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

    // Idempotency: an already active attendance does not change capacity.
    if (existing?.isActive) {
      const current = await this.eventRepo.findById(eventId);
      return EventOutputMapper.toOutput(current!);
    }

    // Reload aggregate to mutate fresh capacity state.
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(input.event_id, Event);
    }

    event.addAttendee(input.audience_id, now);
    if (event.notification.hasErrors()) {
      throw new EntityValidationError(event.notification.toJSON());
    }

    if (existing) {
      existing.rejoin(now);
      if (existing.notification.hasErrors()) {
        throw new EntityValidationError(existing.notification.toJSON());
      }
      await attendeeRepo.update(existing);
    } else {
      const attendee = EventAttendee.create({
        event_id: eventId.id,
        audience_id: input.audience_id,
        joined_at: now,
      });
      if (attendee.notification.hasErrors()) {
        throw new EntityValidationError(attendee.notification.toJSON());
      }
      await attendeeRepo.insert(attendee);
    }

    await this.eventRepo.update(event);
    return EventOutputMapper.toOutput(event);
  }
}
