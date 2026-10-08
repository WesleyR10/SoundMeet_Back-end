import { ForbiddenException } from "@nestjs/common";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { LuxonDateTimeService } from "../../../../../shared/infra/date-time/luxon-date-time.service";
import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { ReviseBookingProposalUseCase } from "../revise-booking-proposal.use-case";

const HOUR = 60 * 60 * 1000;

/*
 * ⚠️ Relógio REAL, não fixo em 2024: o fake builder carimba `created_at` com o
 * agora de verdade, e o agregado recusa `expires_at <= created_at`. Um relógio
 * no passado faria toda revisão falhar por um motivo que não é o testado.
 */
const now = new Date();
const inDays = (days: number, hour = 22) => {
  const date = new Date(now.getTime() + days * 24 * HOUR);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

describe("ReviseBookingProposalUseCase", () => {
  let bookingRepo: BookingInMemoryRepository;
  let useCase: ReviseBookingProposalUseCase;
  const establishmentId = new Uuid().id;
  const musicianId = new Uuid().id;

  const aProposal = () =>
    Booking.fake()
      .aBooking()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(inDays(5))
      .withEndAt(inDays(5, 23))
      .withBufferMinutes(0)
      .withExpiresAt(new Date(now.getTime() + 24 * HOUR));

  const revision = (booking: Booking) => ({
    booking_id: booking.booking_id.id,
    start_at: inDays(7, 21),
    end_at: inDays(7, 23),
    fee: 900,
    notes: "  Passagem de som às 19h  ",
    proposed_by: "establishment" as const,
    requesting_participant_ids: [establishmentId],
  });

  beforeEach(() => {
    bookingRepo = new BookingInMemoryRepository();
    useCase = new ReviseBookingProposalUseCase(
      bookingRepo,
      new LuxonDateTimeService(),
      undefined,
      undefined,
      { now: () => now },
    );
  });

  it("revises the terms of a PENDING proposal and hands the turn to the other side", async () => {
    const booking = aProposal().pending().build();
    await bookingRepo.insert(booking);

    const output = await useCase.execute(revision(booking));

    expect(output.status).toBe("pending");
    expect(output.fee).toBe(900);
    expect(output.notes).toBe("Passagem de som às 19h");
    expect(output.start_at).toEqual(inDays(7, 21));
    expect(output.proposed_by).toBe("establishment");
    // Prazo novo: 48h a partir da revisão, não o prazo da oferta anterior.
    expect(output.expires_at).toEqual(new Date(now.getTime() + 48 * HOUR));
  });

  it("🔴 reopens a DECLINED proposal (cancelled, never confirmed) and clears the refusal", async () => {
    const booking = aProposal().pending().build();
    booking.cancel(now, "musician", "Cachê baixo");
    await bookingRepo.insert(booking);

    const output = await useCase.execute(revision(booking));

    expect(output.status).toBe("pending");
    expect(output.cancelled_at).toBeNull();

    // A recusa deixou de valer: manter o autor e o motivo num booking pendente
    // faria a tela afirmar uma recusa que já não existe.
    const stored = await bookingRepo.findById(booking.booking_id);
    expect(stored?.cancelled_by).toBeNull();
    expect(stored?.cancellation_reason).toBeNull();
  });

  it("reopens an EXPIRED proposal", async () => {
    const booking = aProposal().expired().build();
    await bookingRepo.insert(booking);

    const output = await useCase.execute(revision(booking));

    expect(output.status).toBe("pending");
  });

  it("🔴 refuses a proposal that was ever CONFIRMED — it has a contract", async () => {
    const booking = aProposal().pending().build();
    booking.confirm(now);
    booking.cancel(now, "establishment", "Mudança de planos");
    await bookingRepo.insert(booking);

    await expect(useCase.execute(revision(booking))).rejects.toThrow(
      EntityValidationError,
    );

    const stored = await bookingRepo.findById(booking.booking_id);
    expect(stored?.status.value).toBe("cancelled");
  });

  it("refuses a revision that starts in the past", async () => {
    const booking = aProposal().pending().build();
    await bookingRepo.insert(booking);

    await expect(
      useCase.execute({
        ...revision(booking),
        start_at: new Date(now.getTime() - HOUR),
        end_at: new Date(now.getTime() + HOUR),
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("refuses when the musician already has a confirmed show in the new slot", async () => {
    const booking = aProposal().pending().build();
    await bookingRepo.insert(booking);

    const clash = Booking.fake()
      .aBooking()
      .withMusicianId(musicianId)
      .withBandId(null)
      .withStartAt(inDays(7, 20))
      .withEndAt(inDays(7, 22))
      .withBufferMinutes(0)
      .confirmed()
      .build();
    await bookingRepo.insert(clash);

    await expect(useCase.execute(revision(booking))).rejects.toMatchObject({
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

  it("forbids someone who is not a side of the negotiation", async () => {
    const booking = aProposal().pending().build();
    await bookingRepo.insert(booking);

    await expect(
      useCase.execute({
        ...revision(booking),
        requesting_participant_ids: [new Uuid().id],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws NotFoundError for an unknown booking", async () => {
    await expect(
      useCase.execute({
        ...revision(aProposal().pending().build()),
        booking_id: new Uuid().id,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
