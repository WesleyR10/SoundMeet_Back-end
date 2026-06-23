import { BookingId } from "../../../core/scheduling/domain/booking.aggregate";
import { BookingConfirmedEvent } from "../../../core/scheduling/domain/events/booking-confirmed.event";
import {
  EstablishmentAnalyticsEventsHandlers,
  IBookingLookupGateway,
} from "../establishment-analytics-events.handlers";

describe("EstablishmentAnalyticsEventsHandlers", () => {
  it("recalculates daily analytics from the booking read model lookup", async () => {
    const bookingId = new BookingId();
    const establishmentId = "9366b7dc-2d71-4799-b91c-c64adb205104";
    const startAt = new Date("2026-06-19T22:30:00.000Z");
    const metricsDate = new Date("2026-06-19T00:00:00.000Z");
    const bookingLookup: IBookingLookupGateway = {
      findBookingAnalyticsLookup: jest.fn().mockResolvedValue({
        establishment_id: establishmentId,
        start_at: startAt,
      }),
    };
    const analyticsRepo = {
      calculateDailyMetrics: jest.fn().mockResolvedValue({
        date: metricsDate,
        events_hosted: 1,
        total_attendees: 42,
        musicians_hired: 3,
        total_spent: 1500,
        avg_rating: 4.5,
      }),
      upsertDaily: jest.fn().mockImplementation((entity) => entity),
    };
    const handler = new EstablishmentAnalyticsEventsHandlers(
      bookingLookup,
      analyticsRepo as any,
    );

    await handler.handleBookingConfirmed(
      new BookingConfirmedEvent({
        booking_id: bookingId,
        confirmed_at: new Date("2026-06-18T12:00:00.000Z"),
      }),
    );

    expect(bookingLookup.findBookingAnalyticsLookup).toHaveBeenCalledWith(
      bookingId.id,
    );
    expect(analyticsRepo.calculateDailyMetrics).toHaveBeenCalledWith(
      establishmentId,
      metricsDate,
    );
    expect(analyticsRepo.upsertDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        establishment_id: expect.objectContaining({ id: establishmentId }),
        events_hosted: 1,
        total_attendees: 42,
        musicians_hired: 3,
        total_spent: 1500,
        avg_rating: 4.5,
      }),
    );
  });
});
