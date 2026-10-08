import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { CompleteConfirmedBookingsUseCase } from "../complete-confirmed-bookings.use-case";

describe("CompleteConfirmedBookingsUseCase Unit Tests", () => {
  it("should complete confirmed bookings whose end_at is past the completion delay", async () => {
    const repo = new BookingInMemoryRepository();
    const now = new Date("2024-01-10T00:00:00.000Z");

    const dueBooking = Booking.fake()
      .aBooking()
      .confirmed()
      .withEndAt(new Date("2024-01-08T23:59:59.000Z")) // > 24h antes de `now`
      .build();

    const stillInDisputeWindow = Booking.fake()
      .aBooking()
      .confirmed()
      .withEndAt(new Date("2024-01-09T12:00:00.000Z")) // < 24h antes de `now`
      .build();

    const notConfirmed = Booking.fake()
      .aBooking()
      .pending()
      .withEndAt(new Date("2024-01-01T00:00:00.000Z"))
      .build();

    await repo.bulkInsert([dueBooking, stillInDisputeWindow, notConfirmed]);

    const domainEventMediator = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishIntegrationEvents: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new CompleteConfirmedBookingsUseCase(
      repo,
      domainEventMediator,
      24,
      { now: () => now },
    );

    const output = await useCase.execute({});

    expect(output).toStrictEqual({ completed: 1 });

    const updatedDue = await repo.findById(dueBooking.booking_id);
    expect(updatedDue?.status.isCompleted()).toBe(true);
    expect(updatedDue?.completed_at).toStrictEqual(now);

    const updatedStillInWindow = await repo.findById(
      stillInDisputeWindow.booking_id,
    );
    expect(updatedStillInWindow?.status.isConfirmed()).toBe(true);

    expect(domainEventMediator.publish).toHaveBeenCalledTimes(1);
    expect(domainEventMediator.publishIntegrationEvents).toHaveBeenCalledTimes(
      1,
    );
  });

  it("should count all completed bookings and default to the 24h delay", async () => {
    const repo = new BookingInMemoryRepository();
    const now = new Date("2024-01-10T00:00:00.000Z");

    const completedA = Booking.fake()
      .aBooking()
      .confirmed()
      .withEndAt(new Date("2024-01-01T00:00:00.000Z"))
      .build();

    const completedB = Booking.fake()
      .aBooking()
      .confirmed()
      .withEndAt(new Date("2024-01-09T00:00:00.000Z"))
      .build();

    await repo.bulkInsert([completedA, completedB]);

    const domainEventMediator = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishIntegrationEvents: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new CompleteConfirmedBookingsUseCase(
      repo,
      domainEventMediator,
      undefined,
      { now: () => now },
    );

    const output = await useCase.execute({});

    expect(output).toStrictEqual({ completed: 2 });
  });

  it("should work without a domainEventMediator", async () => {
    const repo = new BookingInMemoryRepository();
    const now = new Date("2024-01-10T00:00:00.000Z");

    const dueBooking = Booking.fake()
      .aBooking()
      .confirmed()
      .withEndAt(new Date("2024-01-01T00:00:00.000Z"))
      .build();

    await repo.bulkInsert([dueBooking]);

    const useCase = new CompleteConfirmedBookingsUseCase(repo, undefined, 24, {
      now: () => now,
    });

    const output = await useCase.execute({});

    expect(output).toStrictEqual({ completed: 1 });
  });
});
