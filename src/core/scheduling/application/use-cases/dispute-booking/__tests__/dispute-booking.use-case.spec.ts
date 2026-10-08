import { ForbiddenException } from "@nestjs/common";

import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { DisputeBookingUseCase } from "../dispute-booking.use-case";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "99999999-9999-4999-8999-999999999999";

const START = new Date("2026-09-12T23:00:00Z");
const END = new Date("2026-09-13T01:30:00Z");
const NOW = new Date("2026-09-13T02:00:00Z");

describe("DisputeBookingUseCase", () => {
  let bookingRepo: BookingInMemoryRepository;
  let useCase: DisputeBookingUseCase;

  beforeEach(() => {
    bookingRepo = new BookingInMemoryRepository();
    useCase = new DisputeBookingUseCase(bookingRepo, { now: () => NOW });
  });

  async function seed(): Promise<Booking> {
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

  it("o estabelecimento contesta com motivo e hora do servidor", async () => {
    const booking = await seed();

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
      reason: "banda tocou 40 minutos, não 2 horas",
      requesting_participant_ids: [ESTABLISHMENT_ID],
    });

    expect(output.disputed_at).toEqual(NOW);
    expect(output.dispute_reason).toBe("banda tocou 40 minutos, não 2 horas");
  });

  it("🔴 o MÚSICO não pode contestar", async () => {
    // Contestar é dizer "o serviço não foi entregue". Deixar o artista fazer
    // isso seria deixá-lo travar o próprio pagamento.
    const booking = await seed();

    await expect(
      useCase.execute({
        booking_id: booking.booking_id.id,
        reason: "quero segurar meu próprio cachê",
        requesting_participant_ids: [MUSICIAN_ID],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const persisted = await bookingRepo.findById(booking.booking_id);
    expect(persisted!.isDisputed).toBe(false);
  });

  it("recusa quem não é parte", async () => {
    const booking = await seed();

    await expect(
      useCase.execute({
        booking_id: booking.booking_id.id,
        reason: "qualquer",
        requesting_participant_ids: [OUTSIDER_ID],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("recusa ator sem identidade em vez de pular a checagem", async () => {
    const booking = await seed();

    await expect(
      useCase.execute({
        booking_id: booking.booking_id.id,
        reason: "qualquer",
        requesting_participant_ids: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("admin contesta em nome da mediação", async () => {
    const booking = await seed();

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
      reason: "aberto pelo suporte a pedido da casa",
      requesting_participant_ids: [OUTSIDER_ID],
      is_admin: true,
    });

    expect(output.disputed_at).toEqual(NOW);
  });

  it("recusa contestação sem motivo", async () => {
    const booking = await seed();

    await expect(
      useCase.execute({
        booking_id: booking.booking_id.id,
        reason: "   ",
        requesting_participant_ids: [ESTABLISHMENT_ID],
      }),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("NÃO exige check-in prévio — 'o artista não apareceu' é o caso principal", async () => {
    const booking = await seed();

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
      reason: "artista não compareceu",
      requesting_participant_ids: [ESTABLISHMENT_ID],
    });

    expect(output.checked_in_at).toBeNull();
    expect(output.disputed_at).toEqual(NOW);
  });

  it("repetir é idempotente — a primeira contestação é a que vale", async () => {
    const booking = await seed();
    const base = {
      booking_id: booking.booking_id.id,
      requesting_participant_ids: [ESTABLISHMENT_ID],
    };
    await useCase.execute({ ...base, reason: "primeiro motivo" });

    const spy = jest.spyOn(bookingRepo, "update");
    const output = await useCase.execute({ ...base, reason: "reescrito" });

    expect(output.dispute_reason).toBe("primeiro motivo");
    expect(spy).not.toHaveBeenCalled();
  });
});
