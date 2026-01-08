import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { ExpirePendingBookingsUseCase } from "../expire-pending-bookings.use-case";

describe("ExpirePendingBookingsUseCase Unit Tests", () => {
  it("should expire pending bookings with expires_at <= now", async () => {
    const repo = new BookingInMemoryRepository();
    const now = new Date("2024-01-01T10:00:00.000Z");

    const expiredBooking = Booking.fake()
      .aBooking()
      .pending()
      .withExpiresAt(new Date("2024-01-01T09:59:59.000Z"))
      .build();

    const notExpiredBooking = Booking.fake()
      .aBooking()
      .pending()
      .withExpiresAt(new Date("2024-01-01T10:00:01.000Z"))
      .build();

    const withoutExpiresAt = Booking.fake()
      .aBooking()
      .pending()
      .withExpiresAt(null)
      .build();

    const confirmedExpiredAt = Booking.fake()
      .aBooking()
      .confirmed()
      .withExpiresAt(new Date("2024-01-01T09:00:00.000Z"))
      .build();

    await repo.bulkInsert([
      expiredBooking,
      notExpiredBooking,
      withoutExpiresAt,
      confirmedExpiredAt,
    ]);

    const useCase = new ExpirePendingBookingsUseCase(repo, { now: () => now });
    const output = await useCase.execute({});

    expect(output).toStrictEqual({ expired: 1 });

    const updatedExpired = await repo.findById(expiredBooking.booking_id);
    expect(updatedExpired?.status.isExpired()).toBe(true);

    const updatedNotExpired = await repo.findById(notExpiredBooking.booking_id);
    expect(updatedNotExpired?.status.isPending()).toBe(true);
  });

  it("should count all expired pending bookings", async () => {
    const repo = new BookingInMemoryRepository();
    const now = new Date("2024-01-01T10:00:00.000Z");

    const expiredA = Booking.fake()
      .aBooking()
      .pending()
      .withExpiresAt(new Date("2024-01-01T09:00:00.000Z"))
      .build();

    const expiredB = Booking.fake()
      .aBooking()
      .pending()
      .withExpiresAt(new Date("2024-01-01T10:00:00.000Z"))
      .build();

    const expiredC = Booking.fake()
      .aBooking()
      .pending()
      .withExpiresAt(new Date("2023-12-31T10:00:00.000Z"))
      .build();

    await repo.bulkInsert([expiredA, expiredB, expiredC]);

    const useCase = new ExpirePendingBookingsUseCase(repo, { now: () => now });
    const output = await useCase.execute({});

    expect(output).toStrictEqual({ expired: 3 });
  });
});
