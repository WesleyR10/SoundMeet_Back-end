import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { EventInMemoryRepository } from "../../../../infra/db/in-memory/event-in-memory.repository";
import { CreateEventInput } from "../create-event.input";
import { CreateEventUseCase } from "../create-event.use-case";

describe("CreateEventUseCase Unit Tests", () => {
  test("should create an event", async () => {
    const eventRepo = new EventInMemoryRepository();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const useCase = new CreateEventUseCase(eventRepo);

    const input = new CreateEventInput({
      establishment_id: new Uuid().id,
      name: "Event",
      description: "Description",
      start_at: now,
      end_at: new Date(now.getTime() + 60 * 60 * 1000),
      max_capacity: 10,
      is_public: true,
      cover_charge: 5,
    });

    const output = await useCase.execute(input);

    expect(output.id).toBeDefined();
    expect(output.name).toBe("Event");
    expect(output.status).toBe("scheduled");
  });
});
