import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { EstablishmentAnalytics } from "../../core/establishment/domain/establishment-analytics.read-model";
import { IEstablishmentAnalyticsRepository } from "../../core/establishment/domain/establishment-analytics.repository";
import { BookingCancelledEvent } from "../../core/scheduling/domain/events/booking-cancelled.event";
import { BookingCompletedEvent } from "../../core/scheduling/domain/events/booking-completed.event";
import { BookingConfirmedEvent } from "../../core/scheduling/domain/events/booking-confirmed.event";
import { PrismaService } from "../database-module/prisma/prisma.service";

const toUtcDateOnly = (date: Date): Date => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

export const BOOKING_LOOKUP_GATEWAY = "BookingLookupGateway";

export type BookingAnalyticsLookup = {
  establishment_id: string;
  start_at: Date;
};

export interface IBookingLookupGateway {
  findBookingAnalyticsLookup(
    booking_id: string,
  ): Promise<BookingAnalyticsLookup | null>;
}

@Injectable()
export class PrismaBookingLookupGateway implements IBookingLookupGateway {
  constructor(private readonly prisma: PrismaService) {}

  async findBookingAnalyticsLookup(
    booking_id: string,
  ): Promise<BookingAnalyticsLookup | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: booking_id },
      select: { establishmentId: true, start_at: true },
    });

    const establishment_id = booking?.establishmentId;
    const start_at = booking?.start_at;
    if (!establishment_id || !start_at) {
      return null;
    }

    return { establishment_id, start_at };
  }
}

@Injectable()
export class EstablishmentAnalyticsEventsHandlers {
  constructor(
    @Inject(BOOKING_LOOKUP_GATEWAY)
    private readonly bookingLookup: IBookingLookupGateway,
    @Inject("EstablishmentAnalyticsRepository")
    private readonly analyticsRepo: IEstablishmentAnalyticsRepository,
  ) {}

  @OnEvent(BookingConfirmedEvent.name)
  async handleBookingConfirmed(event: BookingConfirmedEvent) {
    await this.recalculateByBookingId(event.aggregate_id.id);
  }

  @OnEvent(BookingCancelledEvent.name)
  async handleBookingCancelled(event: BookingCancelledEvent) {
    await this.recalculateByBookingId(
      event.aggregate_id.id,
      event.booking_start_at,
    );
  }

  @OnEvent(BookingCompletedEvent.name)
  async handleBookingCompleted(event: BookingCompletedEvent) {
    await this.recalculateByBookingId(event.aggregate_id.id);
  }

  private async recalculateByBookingId(
    booking_id: string,
    fallbackStartAt?: Date,
  ): Promise<void> {
    const lookup =
      await this.bookingLookup.findBookingAnalyticsLookup(booking_id);

    const establishmentId = lookup?.establishment_id;
    if (!establishmentId) {
      return;
    }

    const startAt = lookup?.start_at ?? fallbackStartAt;
    if (!startAt) {
      return;
    }

    const day = toUtcDateOnly(startAt);
    const metrics = await this.analyticsRepo.calculateDailyMetrics(
      establishmentId,
      day,
    );

    const entity = EstablishmentAnalytics.create({
      establishment_id: establishmentId,
      date: metrics.date,
      events_hosted: metrics.events_hosted,
      total_attendees: metrics.total_attendees,
      musicians_hired: metrics.musicians_hired,
      total_spent: metrics.total_spent,
      avg_rating: metrics.avg_rating,
    });

    if (entity.notification.hasErrors()) {
      return;
    }

    await this.analyticsRepo.upsertDaily(entity);
  }
}
