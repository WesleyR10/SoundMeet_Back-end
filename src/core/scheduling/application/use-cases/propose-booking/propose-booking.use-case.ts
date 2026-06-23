import { Band, BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IDateTimeService } from "../../../../shared/domain";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import { Booking } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { ProposeBookingInput } from "./propose-booking.input";

export class ProposeBookingUseCase implements IUseCase<
  ProposeBookingInput,
  ProposeBookingOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly dateTimeService: IDateTimeService,
    private readonly availabilityRepo?: IAvailabilityRepository,
    private readonly bandRepo?: IBandRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
    private readonly bookingDefaultFreeCancellationHours?: number,
  ) {}

  async execute(input: ProposeBookingInput): Promise<ProposeBookingOutput> {
    const now = this.clock.now();
    const expires_at =
      input.expires_at ?? this.dateTimeService.addHours(now, 48);

    const availability = this.availabilityRepo
      ? input.musician_id
        ? await this.availabilityRepo.findByMusicianId(input.musician_id)
        : input.band_id
          ? await this.availabilityRepo.findByBandId(input.band_id)
          : null
      : null;

    const buffer_minutes =
      input.buffer_minutes ?? availability?.default_buffer_minutes ?? 0;

    const entity = Booking.create({
      establishment_id: input.establishment_id,
      musician_id: input.musician_id ?? null,
      band_id: input.band_id ?? null,
      event_id: input.event_id ?? null,
      start_at: input.start_at,
      end_at: input.end_at,
      fee: input.fee ?? null,
      notes: input.notes ?? null,
      buffer_minutes,
      expires_at,
      ...(this.bookingDefaultFreeCancellationHours !== undefined
        ? { free_cancellation_hours: this.bookingDefaultFreeCancellationHours }
        : {}),
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    const candidateStart = entity.bufferedStartAt;
    const candidateEnd = entity.bufferedEndAt;

    if (entity.musician_id) {
      if (
        availability &&
        !availability.isAvailable(
          candidateStart,
          candidateEnd,
          this.dateTimeService,
        )
      ) {
        throw new EntityValidationError([
          {
            target: ["Musician is unavailable for this period"],
          },
        ]);
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

      if (availability?.max_shows_per_day !== null && availability) {
        const showsToday = await this.bookingRepo.countConfirmedOnDayByMusician(
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

    if (entity.band_id) {
      if (
        availability &&
        !availability.isAvailable(
          candidateStart,
          candidateEnd,
          this.dateTimeService,
        )
      ) {
        throw new EntityValidationError([
          {
            target: ["Band is unavailable for this period"],
          },
        ]);
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

      if (this.bandRepo) {
        const band = await this.bandRepo.findById(
          new BandId(entity.band_id.id),
        );
        if (!band) {
          throw new NotFoundError(entity.band_id.id, Band);
        }
      }
    }

    entity.expire(now);

    await this.bookingRepo.insert(entity);
    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return BookingOutputMapper.toOutput(entity);
  }
}

export type ProposeBookingOutput = BookingOutput;
