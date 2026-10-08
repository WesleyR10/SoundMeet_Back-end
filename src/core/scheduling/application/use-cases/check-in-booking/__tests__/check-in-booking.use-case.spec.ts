import { ForbiddenException } from "@nestjs/common";

import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { CheckInBookingUseCase } from "../check-in-booking.use-case";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "99999999-9999-4999-8999-999999999999";

const START = new Date("2026-09-12T23:00:00Z");
const END = new Date("2026-09-13T01:30:00Z");
const DURANTE = new Date("2026-09-12T23:30:00Z");

describe("CheckInBookingUseCase", () => {
  let bookingRepo: BookingInMemoryRepository;
  let bandRepo: BandInMemoryRepository;
  let useCase: CheckInBookingUseCase;

  beforeEach(() => {
    bookingRepo = new BookingInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    useCase = new CheckInBookingUseCase(bookingRepo, bandRepo, {
      now: () => DURANTE,
    });
  });

  async function seedConfirmado(): Promise<Booking> {
    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      start_at: START,
      end_at: END,
      fee: 1500,
    });
    booking.confirm(new Date("2026-09-01T12:00:00Z"));
    await bookingRepo.insert(booking);
    return booking;
  }

  it("registra a apresentação com a hora do SERVIDOR", async () => {
    // A data não vem do corpo de propósito: este registro existe para provar
    // *quando* algo aconteceu.
    const booking = await seedConfirmado();

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
      requesting_participant_ids: [MUSICIAN_ID],
      requesting_musician_id: MUSICIAN_ID,
    });

    expect(output.checked_in_at).toEqual(DURANTE);
    const persisted = await bookingRepo.findById(booking.booking_id);
    expect(persisted!.checked_in_at).toEqual(DURANTE);
  });

  it("o estabelecimento também pode registrar", async () => {
    // Deliberado: em muita casa quem tem o app aberto no fim da noite é o dono,
    // e um check-in feito pela contraparte é prova ainda mais forte.
    const booking = await seedConfirmado();

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
      requesting_participant_ids: [ESTABLISHMENT_ID],
    });

    expect(output.checked_in_at).toEqual(DURANTE);
  });

  it("recusa quem não é parte", async () => {
    const booking = await seedConfirmado();

    await expect(
      useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: [OUTSIDER_ID],
        requesting_musician_id: OUTSIDER_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const persisted = await bookingRepo.findById(booking.booking_id);
    expect(persisted!.isCheckedIn).toBe(false);
  });

  it("recusa check-in antes do show começar", async () => {
    const booking = await seedConfirmado();
    const antes = new CheckInBookingUseCase(bookingRepo, bandRepo, {
      now: () => new Date("2026-09-12T20:00:00Z"),
    });

    await expect(
      antes.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: [MUSICIAN_ID],
        requesting_musician_id: MUSICIAN_ID,
      }),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("recusa check-in em booking não confirmado", async () => {
    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      start_at: START,
      end_at: END,
      fee: 1500,
    });
    await bookingRepo.insert(booking);

    await expect(
      useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: [MUSICIAN_ID],
        requesting_musician_id: MUSICIAN_ID,
      }),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("repetir é idempotente e não regrava", async () => {
    const booking = await seedConfirmado();
    const input = {
      booking_id: booking.booking_id.id,
      requesting_participant_ids: [MUSICIAN_ID],
      requesting_musician_id: MUSICIAN_ID,
    };
    await useCase.execute(input);

    const spy = jest.spyOn(bookingRepo, "update");
    const output = await useCase.execute(input);

    expect(output.checked_in_at).toEqual(DURANTE);
    expect(spy).not.toHaveBeenCalled();
  });

  it("404 para booking inexistente", async () => {
    await expect(
      useCase.execute({
        booking_id: "66666666-6666-4666-8666-666666666666",
        requesting_participant_ids: [MUSICIAN_ID],
      }),
    ).rejects.toThrow(/Not Found/i);
  });
});
