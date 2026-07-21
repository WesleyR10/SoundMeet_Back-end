import { BookingId } from "../../../core/scheduling/domain/booking.aggregate";
import { BookingCancelledEvent } from "../../../core/scheduling/domain/events/booking-cancelled.event";
import { BookingConfirmedEvent } from "../../../core/scheduling/domain/events/booking-confirmed.event";
import { GoogleCalendarSyncEventsHandler } from "../google-calendar-sync-events.handler";

describe("GoogleCalendarSyncEventsHandler", () => {
  const makeDispatcher = () => ({
    enqueueBookingConfirmed: jest.fn().mockResolvedValue(undefined),
    enqueueBookingCancelled: jest.fn().mockResolvedValue(undefined),
  });

  it("enfileira sync no BookingConfirmedEvent", async () => {
    const dispatcher = makeDispatcher();
    const handler = new GoogleCalendarSyncEventsHandler(dispatcher);
    const bookingId = new BookingId();

    await handler.onBookingConfirmed(
      new BookingConfirmedEvent({
        booking_id: bookingId,
        confirmed_at: new Date(),
      }),
    );

    expect(dispatcher.enqueueBookingConfirmed).toHaveBeenCalledWith({
      booking_id: bookingId.id,
    });
  });

  it("enfileira remoção no BookingCancelledEvent", async () => {
    const dispatcher = makeDispatcher();
    const handler = new GoogleCalendarSyncEventsHandler(dispatcher);
    const bookingId = new BookingId();

    await handler.onBookingCancelled(
      new BookingCancelledEvent({
        booking_id: bookingId,
        cancelled_by: "establishment",
        reason: null,
        cancelled_at: new Date(),
        booking_start_at: new Date(),
      }),
    );

    expect(dispatcher.enqueueBookingCancelled).toHaveBeenCalledWith({
      booking_id: bookingId.id,
    });
  });

  it("engole erro do dispatcher — nunca propaga pro fluxo de booking (emitAsync)", async () => {
    const dispatcher = makeDispatcher();
    dispatcher.enqueueBookingConfirmed.mockRejectedValue(
      new Error("broker down"),
    );
    const handler = new GoogleCalendarSyncEventsHandler(dispatcher);

    await expect(
      handler.onBookingConfirmed(
        new BookingConfirmedEvent({
          booking_id: new BookingId(),
          confirmed_at: new Date(),
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
