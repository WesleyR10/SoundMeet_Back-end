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

describe("Booking.reviseProposal — a contraproposta sobre a mesma negociação", () => {
  const HOUR = 60 * 60 * 1000;
  const now = new Date();
  const later = (hours: number) => new Date(now.getTime() + hours * HOUR);

  const terms = {
    start_at: later(72),
    end_at: later(75),
    fee: 800,
    notes: null,
    proposed_by: "establishment" as const,
    expires_at: later(48),
    now,
  };

  test("emits BookingProposalRevisedEvent — NUNCA BookingProposedEvent, que abriria outra conversa", () => {
    const booking = Booking.fake().aBooking().pending().build();
    booking.clearEvents();

    booking.reviseProposal(terms);

    const names = Array.from(booking.events).map((e) => e.constructor.name);
    expect(names).toEqual(["BookingProposalRevisedEvent"]);
  });

  test("narrates the previous status, so the artist can be told what happened", () => {
    const booking = Booking.fake().aBooking().expired().build();
    booking.clearEvents();

    booking.reviseProposal(terms);

    const [event] = Array.from(booking.events) as unknown as Array<{
      previous_status: string;
    }>;
    expect(event.previous_status).toBe("expired");
    expect(booking.status.value).toBe("pending");
  });

  test("keeps the parties: only terms, authorship and deadline change", () => {
    const booking = Booking.fake().aBooking().pending().build();
    const establishment = booking.establishment_id.id;
    const musician = booking.musician_id?.id ?? null;
    const band = booking.band_id?.id ?? null;

    booking.reviseProposal(terms);

    expect(booking.establishment_id.id).toBe(establishment);
    expect(booking.musician_id?.id ?? null).toBe(musician);
    expect(booking.band_id?.id ?? null).toBe(band);
    expect(booking.proposed_by).toBe("establishment");
    expect(booking.fee).toBe(800);
  });

  test("🔴 refuses a completed show", () => {
    const booking = Booking.fake().aBooking().completed().build();

    booking.reviseProposal(terms);

    expect(booking.notification.hasErrors()).toBe(true);
    expect(booking.status.value).toBe("completed");
  });

  test("refuses end before start, without emitting anything", () => {
    const booking = Booking.fake().aBooking().pending().build();
    booking.clearEvents();

    booking.reviseProposal({ ...terms, end_at: later(70) });

    expect(booking.notification.hasErrors()).toBe(true);
    expect(booking.events.size).toBe(0);
  });
});
