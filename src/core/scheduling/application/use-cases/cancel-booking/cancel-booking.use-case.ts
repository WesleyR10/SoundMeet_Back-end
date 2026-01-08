import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { BookingStatusEnum } from "../../../../shared/domain/value-objects/booking-status.vo";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { CancelBookingInput } from "./cancel-booking.input";

export class CancelBookingUseCase implements IUseCase<
  CancelBookingInput,
  CancelBookingOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: CancelBookingInput): Promise<CancelBookingOutput> {
    const bookingId = new BookingId(input.booking_id);
    const entity = await this.bookingRepo.findById(bookingId);
    if (!entity) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    const now = this.clock.now();

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

    entityToUpdate.cancel(now, input.cancelled_by, input.reason);

    if (entityToUpdate.notification.hasErrors()) {
      throw new EntityValidationError(entityToUpdate.notification.toJSON());
    }

    const updated = await this.bookingRepo.updateWithStatus(entityToUpdate, [
      BookingStatusEnum.PENDING,
      BookingStatusEnum.CONFIRMED,
      BookingStatusEnum.EXPIRED,
    ]);
    if (!updated) {
      entityToUpdate.notification.addError(
        "Booking cannot be cancelled in current status",
        "status",
      );
      throw new EntityValidationError(entityToUpdate.notification.toJSON());
    }

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entityToUpdate);
      await this.domainEventMediator.publishIntegrationEvents(entityToUpdate);
      entityToUpdate.clearEvents();
    }

    return BookingOutputMapper.toOutput(entityToUpdate);
  }
}

export type CancelBookingOutput = BookingOutput;
