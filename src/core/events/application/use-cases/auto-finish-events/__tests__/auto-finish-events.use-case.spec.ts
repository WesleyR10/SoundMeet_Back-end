import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Event } from "../../../../domain/event.aggregate";
import { EventInMemoryRepository } from "../../../../infra/db/in-memory/event-in-memory.repository";
import { AutoFinishEventsUseCase } from "../auto-finish-events.use-case";

const NOW = new Date("2026-08-07T20:00:00.000Z");
const YESTERDAY = new Date("2026-08-06T23:00:00.000Z");
const TOMORROW = new Date("2026-08-08T23:00:00.000Z");
const ESTABLISHMENT = new Uuid("11111111-1111-4111-8111-111111111111");

// start_at precisa vir ANTES de end_at: o default do builder é "daqui a 1h",
// o que deixaria o evento inválido e o `finish()` recusaria por validação —
// exatamente o caminho que o use case pula de propósito.
function eventEndingAt(
  end: Date,
  status: "scheduled" | "active" | "cancelled",
) {
  return Event.fake()
    .anEvent()
    .withEstablishmentId(ESTABLISHMENT)
    .withStartAt(new Date(end.getTime() - 2 * 60 * 60 * 1000))
    .withEndAt(end)
    .withStatus(status)
    .build();
}

describe("AutoFinishEventsUseCase (Bloco 9.4b)", () => {
  let repo: EventInMemoryRepository;
  let useCase: AutoFinishEventsUseCase;

  beforeEach(() => {
    repo = new EventInMemoryRepository();
    useCase = new AutoFinishEventsUseCase(repo, { now: () => NOW });
  });

  it("finaliza evento ativo cujo horário já passou", async () => {
    const past = eventEndingAt(YESTERDAY, "active");
    await repo.insert(past);

    const output = await useCase.execute({});

    expect(output.finished).toBe(1);
    const persisted = await repo.findById(past.entity_id);
    expect(persisted!.status).toBe("completed");
  });

  it("finaliza também os que ficaram em scheduled", async () => {
    await repo.insert(eventEndingAt(YESTERDAY, "scheduled"));

    const output = await useCase.execute({});

    expect(output.finished).toBe(1);
  });

  it("não toca em evento que ainda não terminou", async () => {
    const future = eventEndingAt(TOMORROW, "active");
    await repo.insert(future);

    const output = await useCase.execute({});

    expect(output.finished).toBe(0);
    const persisted = await repo.findById(future.entity_id);
    expect(persisted!.status).toBe("active");
  });

  // Cancelado não vira concluído — são estados finais diferentes.
  it("ignora evento cancelado", async () => {
    const cancelled = eventEndingAt(YESTERDAY, "cancelled");
    await repo.insert(cancelled);

    const output = await useCase.execute({});

    expect(output.finished).toBe(0);
    const persisted = await repo.findById(cancelled.entity_id);
    expect(persisted!.status).toBe("cancelled");
  });

  it("é idempotente — rodar de novo não refaz nada", async () => {
    await repo.insert(eventEndingAt(YESTERDAY, "active"));

    await useCase.execute({});
    const second = await useCase.execute({});

    expect(second.finished).toBe(0);
  });

  it("processa o lote inteiro", async () => {
    await repo.bulkInsert([
      eventEndingAt(YESTERDAY, "active"),
      eventEndingAt(YESTERDAY, "scheduled"),
      eventEndingAt(TOMORROW, "active"),
    ]);

    const output = await useCase.execute({});

    expect(output.finished).toBe(2);
  });
});
