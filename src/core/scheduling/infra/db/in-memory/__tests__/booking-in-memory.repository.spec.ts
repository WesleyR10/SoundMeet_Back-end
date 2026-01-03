import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../booking-in-memory.repository";

describe("BookingInMemoryRepository", () => {
  let repository: BookingInMemoryRepository;

  beforeEach(() => {
    repository = new BookingInMemoryRepository();
  });

  it("should find confirmed bookings for musician overlapping range with buffer", async () => {
    const musicianId = new Uuid();
    const establishmentId = new Uuid();

    const booking = Booking.fake()
      .aBooking()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(new Date("2024-01-01T10:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:00:00.000Z"))
      .withBufferMinutes(30)
      .confirmed()
      .build();

    const nonOverlapping = Booking.fake()
      .aBooking()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(new Date("2024-01-01T13:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T14:00:00.000Z"))
      .withBufferMinutes(0)
      .confirmed()
      .build();

    const pendingBooking = Booking.fake()
      .aBooking()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(new Date("2024-01-01T10:15:00.000Z"))
      .withEndAt(new Date("2024-01-01T10:45:00.000Z"))
      .withBufferMinutes(0)
      .pending()
      .build();

    await repository.bulkInsert([booking, nonOverlapping, pendingBooking]);

    const candidateStart = new Date("2024-01-01T11:15:00.000Z");
    const candidateEnd = new Date("2024-01-01T12:15:00.000Z");

    const result = await repository.findConfirmedInRangeByMusician(
      musicianId.id,
      candidateStart,
      candidateEnd,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id.equals(booking.id)).toBe(true);
  });

  it("should find confirmed bookings for band overlapping range with buffer", async () => {
    const bandId = new Uuid();
    const establishmentId = new Uuid();

    const booking = Booking.fake()
      .aBooking()
      .withEstablishmentId(establishmentId)
      .withMusicianId(null)
      .withBandId(bandId)
      .withStartAt(new Date("2024-01-01T18:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T20:00:00.000Z"))
      .withBufferMinutes(15)
      .confirmed()
      .build();

    await repository.insert(booking);

    const candidateStart = new Date("2024-01-01T20:05:00.000Z");
    const candidateEnd = new Date("2024-01-01T21:00:00.000Z");

    const result = await repository.findConfirmedInRangeByBand(
      bandId.id,
      candidateStart,
      candidateEnd,
    );

    expect(result).toHaveLength(1);
  });
});
