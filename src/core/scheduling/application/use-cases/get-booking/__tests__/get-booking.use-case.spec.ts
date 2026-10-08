import { ForbiddenException } from "@nestjs/common";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { GetBookingUseCase } from "../get-booking.use-case";

const ESTABLISHMENT_A = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_A = "33333333-3333-4333-8333-333333333333";
const OUTSIDER = "99999999-9999-4999-8999-999999999999";
const BAND_A = "55555555-5555-4555-8555-555555555555";
const BAND_MEMBER_NOT_LEADER = "77777777-7777-4777-8777-777777777777";

describe("GetBookingUseCase Unit Tests", () => {
  let repo: BookingInMemoryRepository;
  let useCase: GetBookingUseCase;
  let booking: Booking;

  beforeEach(async () => {
    repo = new BookingInMemoryRepository();
    useCase = new GetBookingUseCase(repo);

    booking = Booking.fake()
      .aBooking()
      .withEstablishmentId(ESTABLISHMENT_A)
      .withMusicianId(MUSICIAN_A)
      .withBandId(null)
      .confirmed()
      .build();

    await repo.insert(booking);
  });

  it("devolve a reserva para o estabelecimento", async () => {
    const output = await useCase.execute({
      booking_id: booking.entity_id.id,
      requesting_participant_ids: [ESTABLISHMENT_A],
    });

    expect(output.id).toBe(booking.entity_id.id);
    expect(output.establishment_id).toBe(ESTABLISHMENT_A);
  });

  it("devolve a reserva para o músico contratado", async () => {
    const output = await useCase.execute({
      booking_id: booking.entity_id.id,
      requesting_participant_ids: [MUSICIAN_A],
    });

    expect(output.id).toBe(booking.entity_id.id);
  });

  it("bloqueia quem não é parte da reserva", async () => {
    await expect(
      useCase.execute({
        booking_id: booking.entity_id.id,
        requesting_participant_ids: [OUTSIDER],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("admin lê qualquer reserva", async () => {
    const output = await useCase.execute({
      booking_id: booking.entity_id.id,
      requesting_participant_ids: [OUTSIDER],
      is_admin: true,
    });

    expect(output.id).toBe(booking.entity_id.id);
  });

  it("404 para reserva inexistente", async () => {
    await expect(
      useCase.execute({
        booking_id: "88888888-8888-4888-8888-888888888888",
        requesting_participant_ids: [ESTABLISHMENT_A],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  // A distinção que separa este use-case do fluxo de confirmar/cancelar:
  // ver a agenda da banda é direito de todo integrante; decidir por ela é do
  // líder. Se aqui usássemos assertNegotiationParticipant, o integrante sem
  // liderança tomaria 403 ao tentar abrir o próprio show.
  it("integrante da banda lê o show sem precisar ser líder", async () => {
    const bandBooking = Booking.fake()
      .aBooking()
      .withEstablishmentId(ESTABLISHMENT_A)
      .withMusicianId(null)
      .withBandId(BAND_A)
      .confirmed()
      .build();
    await repo.insert(bandBooking);

    const output = await useCase.execute({
      booking_id: bandBooking.entity_id.id,
      // Tem o claim band_ids, mas NÃO é o líder — e nenhum bandRepo é passado.
      requesting_participant_ids: [BAND_MEMBER_NOT_LEADER, BAND_A],
      requesting_musician_id: BAND_MEMBER_NOT_LEADER,
    });

    expect(output.id).toBe(bandBooking.entity_id.id);
    expect(output.band_id).toBe(BAND_A);
  });

  it("sem ator identificado (job interno) não restringe", async () => {
    const output = await useCase.execute({
      booking_id: booking.entity_id.id,
    });

    expect(output.id).toBe(booking.entity_id.id);
  });
});
