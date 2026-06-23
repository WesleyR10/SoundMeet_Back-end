import { Band, BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IDateTimeService } from "../../../../shared/domain";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { BookingStatusEnum } from "../../../../shared/domain/value-objects/booking-status.vo";
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
    private readonly dateTimeService: IDateTimeService,
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

    let bandMembers: Array<{ musician_id: { id: string } }> | null = null;

    if (entity.musician_id) {
      if (this.availabilityRepo) {
        const availability = await this.availabilityRepo.findByMusicianId(
          entity.musician_id.id,
        );
        if (
          availability &&
          !availability.isAvailable(
            candidateStart,
            candidateEnd,
            this.dateTimeService,
          )
        ) {
          entity.notification.addError(
            "Musician is unavailable for this period",
            "availability",
          );
          throw new EntityValidationError(entity.notification.toJSON());
        }

        if (availability?.max_shows_per_day !== null && availability) {
          const showsToday =
            await this.bookingRepo.countConfirmedOnDayByMusician(
              entity.musician_id.id,
              entity.start_at,
            );
          if (showsToday >= availability.max_shows_per_day!) {
            entity.notification.addError(
              "Musician reached the maximum shows per day",
              "max_shows_per_day",
            );
            throw new EntityValidationError(entity.notification.toJSON());
          }
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
          !availability.isAvailable(
            candidateStart,
            candidateEnd,
            this.dateTimeService,
          )
        ) {
          entity.notification.addError(
            "Band is unavailable for this period",
            "availability",
          );
          throw new EntityValidationError(entity.notification.toJSON());
        }

        if (availability?.max_shows_per_day !== null && availability) {
          const showsToday = await this.bookingRepo.countConfirmedOnDayByBand(
            entity.band_id.id,
            entity.start_at,
          );
          if (showsToday >= availability.max_shows_per_day!) {
            entity.notification.addError(
              "Band reached the maximum shows per day",
              "max_shows_per_day",
            );
            throw new EntityValidationError(entity.notification.toJSON());
          }
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

      const members = band.members;
      bandMembers = members as any;
    }

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

    entityToUpdate.confirm(now);

    const transactionalConfirm = (this.bookingRepo as any)
      .confirmWithBandMembersAvailability as
      | undefined
      | ((
          booking: Booking,
          expected_statuses: BookingStatusEnum[],
          band_member_ids: string[],
          candidateStart: Date,
          candidateEnd: Date,
        ) => Promise<boolean>);

    const updated =
      bandMembers && typeof transactionalConfirm === "function"
        ? await transactionalConfirm(
            entityToUpdate,
            [BookingStatusEnum.PENDING],
            bandMembers.map((m) => m.musician_id.id),
            candidateStart,
            candidateEnd,
          )
        : await this.bookingRepo.updateWithStatus(entityToUpdate, [
            BookingStatusEnum.PENDING,
          ]);
    if (!updated) {
      entityToUpdate.notification.addError(
        "Only pending bookings can be confirmed",
        "status",
      );
      throw new EntityValidationError(entityToUpdate.notification.toJSON());
    }

    if (bandMembers && this.availabilityRepo && !transactionalConfirm) {
      await Promise.all(
        bandMembers.map(async (member) => {
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
                  reason: `Band booking ${entityToUpdate.booking_id.id}`,
                },
              ],
            });
            await this.availabilityRepo!.insert(newAvailability);
            return;
          }

          if (
            !availability.isAvailable(
              candidateStart,
              candidateEnd,
              this.dateTimeService,
            )
          ) {
            return;
          }

          availability.addUnavailability(
            candidateStart,
            candidateEnd,
            `Band booking ${entityToUpdate.booking_id.id}`,
          );
          await this.availabilityRepo!.update(availability);
        }),
      );
    }

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entityToUpdate);
      await this.domainEventMediator.publishIntegrationEvents(entityToUpdate);
      entityToUpdate.clearEvents();
    }

    return BookingOutputMapper.toOutput(entityToUpdate);
  }
}

export type ConfirmBookingOutput = BookingOutput;
