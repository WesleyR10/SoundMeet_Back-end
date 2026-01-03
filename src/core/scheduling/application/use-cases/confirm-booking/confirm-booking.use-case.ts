import { Band, BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Availability } from "../../../domain/availability.aggregate";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { ConfirmBookingInput } from "./confirm-booking.input";

export class ConfirmBookingUseCase implements IUseCase<
  ConfirmBookingInput,
  ConfirmBookingOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly availabilityRepo?: IAvailabilityRepository,
    private readonly bandRepo?: IBandRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: ConfirmBookingInput): Promise<ConfirmBookingOutput> {
    const bookingId = new BookingId(input.booking_id);
    const entity = await this.bookingRepo.findById(bookingId);
    if (!entity) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    const now = this.clock.now();
    entity.expire(now);
    if (!entity.status.isPending()) {
      entity.notification.addError(
        "Only pending bookings can be confirmed",
        "status",
      );
      throw new EntityValidationError(entity.notification.toJSON());
    }

    const candidateStart = entity.bufferedStartAt;
    const candidateEnd = entity.bufferedEndAt;

    if (entity.musician_id) {
      if (this.availabilityRepo) {
        const availability = await this.availabilityRepo.findByMusicianId(
          entity.musician_id.id,
        );
        if (
          availability &&
          !availability.isAvailable(candidateStart, candidateEnd)
        ) {
          entity.notification.addError(
            "Musician is unavailable for this period",
            "availability",
          );
          throw new EntityValidationError(entity.notification.toJSON());
        }
      }

      const conflicts = await this.bookingRepo.findConfirmedInRangeByMusician(
        entity.musician_id.id,
        candidateStart,
        candidateEnd,
      );
      if (conflicts.length) {
        entity.notification.addError(
          "Musician already has a confirmed booking for this period",
          "conflict",
        );
        throw new EntityValidationError(entity.notification.toJSON());
      }
    }

    if (entity.band_id) {
      if (this.availabilityRepo) {
        const availability = await this.availabilityRepo.findByBandId(
          entity.band_id.id,
        );
        if (
          availability &&
          !availability.isAvailable(candidateStart, candidateEnd)
        ) {
          entity.notification.addError(
            "Band is unavailable for this period",
            "availability",
          );
          throw new EntityValidationError(entity.notification.toJSON());
        }
      }

      const conflicts = await this.bookingRepo.findConfirmedInRangeByBand(
        entity.band_id.id,
        candidateStart,
        candidateEnd,
      );
      if (conflicts.length) {
        entity.notification.addError(
          "Band already has a confirmed booking for this period",
          "conflict",
        );
        throw new EntityValidationError(entity.notification.toJSON());
      }
    }

    if (entity.band_id && this.bandRepo) {
      const band = await this.bandRepo.findById(new BandId(entity.band_id.id));
      if (!band) {
        throw new NotFoundError(entity.band_id.id, Band);
      }

      for (const member of band.members) {
        const conflicts = await this.bookingRepo.findConfirmedInRangeByMusician(
          member.musician_id.id,
          candidateStart,
          candidateEnd,
        );

        if (conflicts.length) {
          entity.notification.addError(
            "Band member already has a confirmed booking for this period",
            "conflict",
          );
          throw new EntityValidationError(entity.notification.toJSON());
        }
      }

      if (this.availabilityRepo) {
        await Promise.all(
          band.members.map(async (member) => {
            const availability = await this.availabilityRepo!.findByMusicianId(
              member.musician_id.id,
            );

            if (!availability) {
              const newAvailability = Availability.create({
                musician_id: member.musician_id.id,
                unavailabilities: [
                  {
                    start_at: candidateStart,
                    end_at: candidateEnd,
                    reason: `Band booking ${entity.id.id}`,
                  },
                ],
              });
              await this.availabilityRepo!.insert(newAvailability);
              return;
            }

            if (!availability.isAvailable(candidateStart, candidateEnd)) {
              return;
            }

            availability.addUnavailability(
              candidateStart,
              candidateEnd,
              `Band booking ${entity.id.id}`,
            );
            await this.availabilityRepo!.update(availability);
          }),
        );
      }
    }

    entity.confirm(now);
    await this.bookingRepo.update(entity);
    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return BookingOutputMapper.toOutput(entity);
  }
}

export type ConfirmBookingOutput = BookingOutput;
