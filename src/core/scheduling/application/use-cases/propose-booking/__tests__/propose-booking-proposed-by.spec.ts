import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { BookingModelMapper } from "../../../../infra/db/prisma/booking-model-mapper";
import { ProposeBookingInput } from "../propose-booking.input";
import { ProposeBookingUseCase } from "../propose-booking.use-case";

/**
 * Regressão do `proposed_by` (W3, soundmeet-web).
 *
 * O defeito que motivou o campo: `assertNegotiationParticipant` autoriza
 * QUALQUER lado da negociação a confirmar, inclusive quem propôs — então um
 * estabelecimento podia confirmar a própria proposta e produzir um booking
 * `confirmed` que o artista nunca aceitou, com a janela de
 * `free_cancellation_hours` já correndo. `proposed_by` não muda a autorização;
 * ele torna a origem legível para quem consome a API.
 */

const ESTABELECIMENTO_ID = "33333333-3333-4333-8333-333333333333";
const MUSICO_ID = "11111111-1111-4111-8111-111111111111";
const SUB_DONO = "22222222-2222-4222-8222-222222222222";

const dateTimeServiceStub = {
  addHours: (date: Date, hours: number) =>
    new Date(date.getTime() + hours * 3600_000),
} as never;

function baseInput(overrides: Record<string, unknown> = {}) {
  return new ProposeBookingInput({
    establishment_id: ESTABELECIMENTO_ID,
    musician_id: MUSICO_ID,
    start_at: new Date("2026-09-10T22:00:00.000Z"),
    end_at: new Date("2026-09-11T02:00:00.000Z"),
    // Proposta sem cachê é recusada desde 25/set/2026 (assertProposalTerms).
    fee: 800,
    requesting_participant_ids: [SUB_DONO, ESTABELECIMENTO_ID],
    requesting_musician_id: SUB_DONO,
    ...overrides,
  });
}

function createUseCase() {
  const repo = new BookingInMemoryRepository();
  const useCase = new ProposeBookingUseCase(repo, dateTimeServiceStub);
  return { repo, useCase };
}

describe("ProposeBookingUseCase — proposed_by", () => {
  it("grava o lado que o controller derivou do JWT", async () => {
    const { useCase } = createUseCase();

    const output = await useCase.execute(
      baseInput({ proposed_by: "establishment" }),
    );

    expect(output.proposed_by).toBe("establishment");
  });

  it("grava 'musician' quando é o artista quem propõe", async () => {
    const { useCase } = createUseCase();

    const output = await useCase.execute(
      baseInput({
        proposed_by: "musician",
        requesting_participant_ids: [MUSICO_ID],
        requesting_musician_id: MUSICO_ID,
      }),
    );

    expect(output.proposed_by).toBe("musician");
  });

  it("fica null quando a origem não foi informada", async () => {
    const { useCase } = createUseCase();

    /*
     * É o caso dos bookings anteriores ao campo e de qualquer chamador interno
     * sem ator HTTP (jobs). O consumidor trata null como "não registrado" e age
     * de forma conservadora — nunca como "proposto pela contraparte".
     */
    const output = await useCase.execute(baseInput());

    expect(output.proposed_by).toBeNull();
  });

  it("persiste o valor no repositório, não só no output", async () => {
    const { repo, useCase } = createUseCase();

    const output = await useCase.execute(
      baseInput({ proposed_by: "establishment" }),
    );
    const persistido = repo.items.find(
      (item) => item.booking_id.id === output.id,
    );

    expect(persistido?.proposed_by).toBe("establishment");
  });

  it("sobrevive à ida e volta pelo mapper do Prisma", async () => {
    const { useCase } = createUseCase();
    const output = await useCase.execute(baseInput({ proposed_by: "band" }));

    // O mapper é o ponto onde um campo novo silenciosamente some: `toModel`
    // esquecido faz a coluna nascer sempre NULL, e nenhum teste de use case
    // percebe porque o agregado em memória continua correto.
    const entidade = BookingModelMapper.toEntity({
      id: output.id,
      establishmentId: output.establishment_id,
      musicianId: output.musician_id,
      bandId: output.band_id,
      eventId: output.event_id,
      start_at: output.start_at,
      end_at: output.end_at,
      fee: output.fee,
      notes: output.notes,
      status: output.status as never,
      proposed_by: output.proposed_by,
      cancelled_by: null,
      cancellation_reason: null,
      buffer_minutes: output.buffer_minutes,
      expires_at: output.expires_at,
      free_cancellation_hours: output.free_cancellation_hours,
      confirmed_at: output.confirmed_at,
      cancelled_at: output.cancelled_at,
      completed_at: output.completed_at,
      checked_in_at: null,
      checked_in_by: null,
      disputed_at: null,
      dispute_reason: null,
      created_at: output.created_at,
      updated_at: output.updated_at,
    });

    expect(entidade.proposed_by).toBe("band");
    expect(BookingModelMapper.toModel(entidade).proposed_by).toBe("band");
  });
});
