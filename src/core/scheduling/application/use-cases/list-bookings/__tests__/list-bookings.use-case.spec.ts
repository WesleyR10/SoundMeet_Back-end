import { ForbiddenException } from "@nestjs/common";

import { Booking } from "../../../../domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { ListBookingsUseCase } from "../list-bookings.use-case";

const ESTABLISHMENT_A = "11111111-1111-4111-8111-111111111111";
const ESTABLISHMENT_B = "22222222-2222-4222-8222-222222222222";
const MUSICIAN_A = "33333333-3333-4333-8333-333333333333";
const MUSICIAN_B = "44444444-4444-4444-8444-444444444444";
const BAND_A = "55555555-5555-4555-8555-555555555555";

function bookingOf(props: {
  establishment: string;
  musician?: string | null;
  band?: string | null;
  confirmed?: boolean;
}): Booking {
  const builder = Booking.fake()
    .aBooking()
    .withEstablishmentId(props.establishment)
    .withMusicianId(props.musician ?? null)
    .withBandId(props.band ?? null);

  return (props.confirmed ? builder.confirmed() : builder.pending()).build();
}

describe("ListBookingsUseCase Unit Tests", () => {
  let repo: BookingInMemoryRepository;
  let useCase: ListBookingsUseCase;

  // A (estab) contratou o músico A; B (estab) contratou o músico B;
  // A também tem um show com a banda A.
  let bookingEstabAMusicianA: Booking;
  let bookingEstabBMusicianB: Booking;
  let bookingEstabABandA: Booking;

  beforeEach(async () => {
    repo = new BookingInMemoryRepository();
    useCase = new ListBookingsUseCase(repo);

    bookingEstabAMusicianA = bookingOf({
      establishment: ESTABLISHMENT_A,
      musician: MUSICIAN_A,
      confirmed: true,
    });
    bookingEstabBMusicianB = bookingOf({
      establishment: ESTABLISHMENT_B,
      musician: MUSICIAN_B,
    });
    bookingEstabABandA = bookingOf({
      establishment: ESTABLISHMENT_A,
      musician: null,
      band: BAND_A,
    });

    await repo.bulkInsert([
      bookingEstabAMusicianA,
      bookingEstabBMusicianB,
      bookingEstabABandA,
    ]);
  });

  describe("escopo por participante", () => {
    it("estabelecimento vê apenas as próprias reservas", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [ESTABLISHMENT_A],
      });

      expect(output.total).toBe(2);
      expect(output.items.map((i) => i.id).sort()).toEqual(
        [
          bookingEstabAMusicianA.entity_id.id,
          bookingEstabABandA.entity_id.id,
        ].sort(),
      );
    });

    // O teste que prova que o vazamento não existe.
    it("não vaza reserva de outro estabelecimento", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [ESTABLISHMENT_A],
      });

      expect(
        output.items.some((i) => i.id === bookingEstabBMusicianB.entity_id.id),
      ).toBe(false);
    });

    it("músico vê apenas as reservas em que é o contratado", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [MUSICIAN_A],
      });

      expect(output.total).toBe(1);
      expect(output.items[0].id).toBe(bookingEstabAMusicianA.entity_id.id);
    });

    // Um id só não dá conta: a pessoa participa pelo `sub` E pelas bandas.
    it("integrante vê a reserva da banda junto com as próprias", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [MUSICIAN_A, BAND_A],
      });

      expect(output.total).toBe(2);
      expect(output.items.map((i) => i.id).sort()).toEqual(
        [
          bookingEstabAMusicianA.entity_id.id,
          bookingEstabABandA.entity_id.id,
        ].sort(),
      );
    });

    it("usuário sem nenhuma reserva recebe lista vazia, não erro", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: ["66666666-6666-4666-8666-666666666666"],
      });

      expect(output.total).toBe(0);
      expect(output.items).toEqual([]);
    });
  });

  describe("fail-closed", () => {
    // Sem isto, uma lista vazia de identidades cairia em "sem filtro" e
    // devolveria a agenda de todos os usuários.
    it("recusa ator identificado sem nenhuma identidade utilizável", async () => {
      await expect(
        useCase.execute({ requesting_participant_ids: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("recusa quando todas as identidades são falsy", async () => {
      await expect(
        useCase.execute({ requesting_participant_ids: ["", null as any] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("admin e chamadas internas", () => {
    it("admin vê tudo", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [ESTABLISHMENT_A],
        is_admin: true,
      });

      expect(output.total).toBe(3);
    });

    it("sem ator (job interno) não restringe", async () => {
      const output = await useCase.execute({});
      expect(output.total).toBe(3);
    });
  });

  describe("filtros refinam dentro do escopo, nunca o ampliam", () => {
    it("status combina em AND com o escopo", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [ESTABLISHMENT_A],
        status: "confirmed",
      });

      expect(output.total).toBe(1);
      expect(output.items[0].id).toBe(bookingEstabAMusicianA.entity_id.id);
    });

    // A tentativa óbvia de burlar: pedir explicitamente o id alheio.
    it("pedir establishment_id de outro não devolve nada", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [ESTABLISHMENT_A],
        establishment_id: ESTABLISHMENT_B,
      });

      expect(output.total).toBe(0);
    });
  });

  describe("paginação", () => {
    it("respeita page/per_page mantendo o total do escopo", async () => {
      const output = await useCase.execute({
        requesting_participant_ids: [ESTABLISHMENT_A],
        page: 1,
        per_page: 1,
      });

      expect(output.items).toHaveLength(1);
      expect(output.total).toBe(2);
      expect(output.current_page).toBe(1);
      expect(output.per_page).toBe(1);
    });
  });
});
