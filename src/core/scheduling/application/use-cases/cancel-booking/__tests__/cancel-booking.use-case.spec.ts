import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { CancelBookingUseCase } from "../cancel-booking.use-case";

describe("CancelBookingUseCase Unit Tests", () => {
  it("should throw when cancelling inside penalty window without reason", async () => {
    const bookingRepo = new BookingInMemoryRepository();
    const now = new Date("2024-01-01T09:00:00.000Z");

    const confirmed = Booking.fake()
      .aBooking()
      .confirmed()
      .withStartAt(new Date("2024-01-01T11:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T12:00:00.000Z"))
      .build();
    await bookingRepo.insert(confirmed);

    const useCase = new CancelBookingUseCase(bookingRepo, { now: () => now });

    await expect(async () => {
      await useCase.execute({
        booking_id: confirmed.booking_id.id,
        cancelled_by: "establishment",
      });
    }).rejects.toMatchObject({
      name: "EntityValidationError",
      error: expect.arrayContaining([
        {
          reason: ["Cancellation reason is required within the penalty window"],
        },
      ]),
    });

    const reloaded = await bookingRepo.findById(confirmed.booking_id);
    expect(reloaded?.status.isConfirmed()).toBe(true);
  });
});
