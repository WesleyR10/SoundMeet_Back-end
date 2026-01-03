import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Booking } from "../booking.aggregate";

describe("Booking Unit Tests", () => {
  test("should calculate buffered range using buffer_minutes", () => {
    const musicianId = new Uuid();
    const startAt = new Date("2024-01-01T10:00:00.000Z");
    const endAt = new Date("2024-01-01T12:00:00.000Z");

    const booking = Booking.fake()
      .aBooking()
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(startAt)
      .withEndAt(endAt)
      .withBufferMinutes(15)
      .confirmed()
      .build();

    expect(booking.bufferedStartAt).toEqual(
      new Date("2024-01-01T09:45:00.000Z"),
    );
    expect(booking.bufferedEndAt).toEqual(new Date("2024-01-01T12:15:00.000Z"));
  });

  test("conflictsWith should consider buffer on both bookings", () => {
    const musicianId = new Uuid();

    const bookingA = Booking.fake()
      .aBooking()
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(new Date("2024-01-01T10:00:00.000Z"))
      .withEndAt(new Date("2024-01-01T11:00:00.000Z"))
      .withBufferMinutes(30)
      .confirmed()
      .build();

    const bookingB = Booking.fake()
      .aBooking()
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(new Date("2024-01-01T11:15:00.000Z"))
      .withEndAt(new Date("2024-01-01T12:15:00.000Z"))
      .withBufferMinutes(0)
      .confirmed()
      .build();

    expect(bookingA.conflictsWith(bookingB)).toBe(true);
    expect(bookingB.conflictsWith(bookingA)).toBe(true);
  });

  test("create should include errors when target is missing", () => {
    const booking = Booking.create({
      establishment_id: new Uuid().id,
      start_at: new Date("2024-01-01T10:00:00.000Z"),
      end_at: new Date("2024-01-01T12:00:00.000Z"),
    });
    expect(booking.notification.hasErrors()).toBe(true);
  });

  test("confirm should include errors when not pending", () => {
    const booking = Booking.fake().aBooking().confirmed().build();
    booking.confirm(new Date());
    expect(booking.notification.hasErrors()).toBe(true);
  });

  test("cancel should require reason inside penalty window", () => {
    const now = new Date("2024-01-01T10:00:00.000Z");
    const startAt = new Date("2024-01-01T11:00:00.000Z");
    const endAt = new Date("2024-01-01T12:00:00.000Z");

    const booking = Booking.fake()
      .aBooking()
      .withStartAt(startAt)
      .withEndAt(endAt)
      .confirmed()
      .build();

    booking.cancel(now, "establishment");
    expect(booking.notification.hasErrors()).toBe(true);
  });
});
