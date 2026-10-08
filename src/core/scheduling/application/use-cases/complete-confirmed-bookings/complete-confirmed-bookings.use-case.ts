import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { BookingStatusEnum } from "../../../../shared/domain/value-objects/booking-status.vo";
import {
  Booking,
  BOOKING_DEFAULT_COMPLETION_DELAY_HOURS,
} from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";

export class CompleteConfirmedBookingsUseCase implements IUseCase<
  CompleteConfirmedBookingsInput,
  CompleteConfirmedBookingsOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly domainEventMediator?: DomainEventMediator,
    private readonly completion_delay_hours: number = BOOKING_DEFAULT_COMPLETION_DELAY_HOURS,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(
    _input: CompleteConfirmedBookingsInput = {},
  ): Promise<CompleteConfirmedBookingsOutput> {
    const now = this.clock.now();
    const threshold = new Date(
      now.getTime() - this.completion_delay_hours * 60 * 60 * 1000,
    );

    const candidates =
      await this.bookingRepo.findConfirmedPastCompletionWindow(threshold);

    let completed = 0;
    for (const entity of candidates) {
      const entityToUpdate = new Booking({
        booking_id: entity.booking_id,
        establishment_id: entity.establishment_id.id,
        musician_id: entity.musician_id?.id ?? null,
        band_id: entity.band_id?.id ?? null,
        event_id: entity.event_id?.id ?? null,
        start_at: entity.start_at,
        end_at: entity.end_at,
        fee: entity.fee,
        notes: entity.notes,
        status: entity.status,
        buffer_minutes: entity.buffer_minutes,
        expires_at: entity.expires_at,
        free_cancellation_hours: entity.free_cancellation_hours,
        confirmed_at: entity.confirmed_at,
        cancelled_at: entity.cancelled_at,
        completed_at: entity.completed_at,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
      });

      entityToUpdate.complete(now);
      if (entityToUpdate.notification.hasErrors()) {
        continue;
      }

      const updated = await this.bookingRepo.updateWithStatus(entityToUpdate, [
        BookingStatusEnum.CONFIRMED,
      ]);
      if (!updated) {
        continue;
      }

      if (this.domainEventMediator) {
        await this.domainEventMediator.publish(entityToUpdate);
        await this.domainEventMediator.publishIntegrationEvents(entityToUpdate);
        entityToUpdate.clearEvents();
      }

      completed += 1;
    }

    return { completed };
  }
}

export type CompleteConfirmedBookingsInput = Record<string, never>;

export type CompleteConfirmedBookingsOutput = {
  completed: number;
};
