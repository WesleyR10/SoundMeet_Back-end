import { Band } from "../../../../../musician/domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Booking } from "../../../../domain/booking.aggregate";
import { AvailabilityInMemoryRepository } from "../../../../infra/db/in-memory/availability-in-memory.repository";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { ConfirmBookingUseCase } from "../confirm-booking.use-case";

describe("ConfirmBookingUseCase Unit Tests", () => {
  it("should not confirm when musician has an existing confirmed booking in range", async () => {
    const bookingRepo = new BookingInMemoryRepository();
    const availabilityRepo = new AvailabilityInMemoryRepository();

    const musicianId = new Uuid();
    const now = new Date("2024-01-01T09:00:00.000Z");

    const confirmed = Booking.fake()
      .aBooking()
      .confirmed()
      .withBandId(null)
      .withMusicianId(musicianId)
      .withStartAt(new Date("2024-01-01T10:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:00:00.000Z"))
      .withBufferMinutes(0)
      .build();
    await bookingRepo.insert(confirmed);

    const pending = Booking.fake()
      .aBooking()
      .pending()
      .withBandId(null)
      .withMusicianId(musicianId)
      .withStartAt(new Date("2024-01-01T10:30:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:30:00.000Z"))
      .withBufferMinutes(0)
      .withExpiresAt(new Date("2024-01-02T09:00:00.000Z"))
      .build();
    await bookingRepo.insert(pending);

    const useCase = new ConfirmBookingUseCase(
      bookingRepo,
      availabilityRepo,
      undefined,
      { now: () => now },
    );

    await expect(async () => {
      await useCase.execute({ booking_id: pending.id.id });
    }).rejects.toMatchObject({
      name: "EntityValidationError",
      error: expect.arrayContaining([
        {
          conflict: [
            "Musician already has a confirmed booking for this period",
          ],
        },
      ]),
    });
  });

  it("should consider buffer when detecting conflicts for musician", async () => {
    const bookingRepo = new BookingInMemoryRepository();
    const availabilityRepo = new AvailabilityInMemoryRepository();

    const musicianId = new Uuid();
    const now = new Date("2024-01-01T09:00:00.000Z");

    const confirmed = Booking.fake()
      .aBooking()
      .confirmed()
      .withBandId(null)
      .withMusicianId(musicianId)
      .withStartAt(new Date("2024-01-01T20:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T23:00:00.000Z"))
      .withBufferMinutes(90)
      .build();
    await bookingRepo.insert(confirmed);

    const pending = Booking.fake()
      .aBooking()
      .pending()
      .withBandId(null)
      .withMusicianId(musicianId)
      .withStartAt(new Date("2024-01-01T23:30:00.000Z"))
      .withEndAt(new Date("2024-01-02T01:00:00.000Z"))
      .withBufferMinutes(0)
      .withExpiresAt(new Date("2024-01-02T09:00:00.000Z"))
      .build();
    await bookingRepo.insert(pending);

    const useCase = new ConfirmBookingUseCase(
      bookingRepo,
      availabilityRepo,
      undefined,
      { now: () => now },
    );

    await expect(async () => {
      await useCase.execute({ booking_id: pending.id.id });
    }).rejects.toMatchObject({
      name: "EntityValidationError",
      error: expect.arrayContaining([
        {
          conflict: [
            "Musician already has a confirmed booking for this period",
          ],
        },
      ]),
    });
  });

  it("should publish domain and integration events when mediator is provided", async () => {
    const bookingRepo = new BookingInMemoryRepository();
    const availabilityRepo = new AvailabilityInMemoryRepository();

    const musicianId = new Uuid();
    const now = new Date("2024-01-01T09:00:00.000Z");

    const pending = Booking.fake()
      .aBooking()
      .pending()
      .withBandId(null)
      .withMusicianId(musicianId)
      .withStartAt(new Date("2024-01-01T10:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:00:00.000Z"))
      .withBufferMinutes(0)
      .withExpiresAt(new Date("2024-01-02T09:00:00.000Z"))
      .build();
    await bookingRepo.insert(pending);

    const domainEventMediator = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishIntegrationEvents: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new ConfirmBookingUseCase(
      bookingRepo,
      availabilityRepo,
      undefined,
      { now: () => now },
      domainEventMediator,
    );

    await useCase.execute({ booking_id: pending.id.id });

    expect(domainEventMediator.publish).toHaveBeenCalledTimes(1);
    expect(domainEventMediator.publishIntegrationEvents).toHaveBeenCalledTimes(
      1,
    );
  });

  it("should block band members when confirming a band booking", async () => {
    const bandRepo = new BandInMemoryRepository();
    const bookingRepo = new BookingInMemoryRepository();
    const availabilityRepo = new AvailabilityInMemoryRepository();

    const memberA = new Uuid();
    const memberB = new Uuid();
    const band = Band.create({
      name: "The Band",
      genres: ["rock"],
      members: [
        {
          musician_id: memberA,
          role: "member",
          instrument: "guitar",
          joined_at: new Date("2024-01-01T00:00:00.000Z"),
        },
        {
          musician_id: memberB,
          role: "member",
          instrument: "drums",
          joined_at: new Date("2024-01-01T00:00:00.000Z"),
        },
      ],
    });
    await bandRepo.insert(band);

    const now = new Date("2024-01-01T09:00:00.000Z");
    const booking = Booking.fake()
      .aBooking()
      .pending()
      .withMusicianId(null)
      .withBandId(band.band_id)
      .withStartAt(new Date("2024-01-01T10:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:00:00.000Z"))
      .withBufferMinutes(30)
      .withExpiresAt(new Date("2024-01-02T09:00:00.000Z"))
      .build();
    await bookingRepo.insert(booking);

    const useCase = new ConfirmBookingUseCase(
      bookingRepo,
      availabilityRepo,
      bandRepo,
      { now: () => now },
    );

    const output = await useCase.execute({ booking_id: booking.id.id });

    expect(output.status).toBe("confirmed");

    const blockedStart = new Date("2024-01-01T09:30:00.000Z");
    const blockedEnd = new Date("2024-01-01T11:30:00.000Z");

    const availabilityA = await availabilityRepo.findByMusicianId(memberA.id);
    expect(availabilityA).not.toBeNull();
    expect(availabilityA!.isAvailable(blockedStart, blockedEnd)).toBe(false);

    const availabilityB = await availabilityRepo.findByMusicianId(memberB.id);
    expect(availabilityB).not.toBeNull();
    expect(availabilityB!.isAvailable(blockedStart, blockedEnd)).toBe(false);
  });

  it("should fail confirming a band booking when a member has conflicts", async () => {
    const bandRepo = new BandInMemoryRepository();
    const bookingRepo = new BookingInMemoryRepository();
    const availabilityRepo = new AvailabilityInMemoryRepository();

    const memberA = new Uuid();
    const memberB = new Uuid();
    const band = Band.create({
      name: "The Band",
      genres: ["rock"],
      members: [
        {
          musician_id: memberA,
          role: "member",
          instrument: "guitar",
          joined_at: new Date("2024-01-01T00:00:00.000Z"),
        },
        {
          musician_id: memberB,
          role: "member",
          instrument: "drums",
          joined_at: new Date("2024-01-01T00:00:00.000Z"),
        },
      ],
    });
    await bandRepo.insert(band);

    const now = new Date("2024-01-01T09:00:00.000Z");
    const pendingBandBooking = Booking.fake()
      .aBooking()
      .pending()
      .withMusicianId(null)
      .withBandId(band.band_id)
      .withStartAt(new Date("2024-01-01T10:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:00:00.000Z"))
      .withBufferMinutes(30)
      .withExpiresAt(new Date("2024-01-02T09:00:00.000Z"))
      .build();
    await bookingRepo.insert(pendingBandBooking);

    const memberConflict = Booking.fake()
      .aBooking()
      .confirmed()
      .withBandId(null)
      .withMusicianId(memberA)
      .withStartAt(new Date("2024-01-01T10:30:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:30:00.000Z"))
      .withBufferMinutes(0)
      .build();
    await bookingRepo.insert(memberConflict);

    const useCase = new ConfirmBookingUseCase(
      bookingRepo,
      availabilityRepo,
      bandRepo,
      { now: () => now },
    );

    await expect(async () => {
      await useCase.execute({ booking_id: pendingBandBooking.id.id });
    }).rejects.toMatchObject({
      name: "EntityValidationError",
      error: expect.arrayContaining([
        {
          conflict: [
            "Band member already has a confirmed booking for this period",
          ],
        },
      ]),
    });
  });
});
