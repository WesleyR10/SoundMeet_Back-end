import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Event } from "../../../../domain";
import { EventInMemoryRepository } from "../../../../infra/db/in-memory/event-in-memory.repository";
import { ListEventsUseCase } from "../list-events.use-case";

describe("ListEventsUseCase — 7.13b", () => {
  let repository: EventInMemoryRepository;
  let useCase: ListEventsUseCase;

  const now = new Date();

  const buildEvent = (
    establishment_id: string,
    is_public: boolean,
  ): Event =>
    Event.create({
      establishment_id,
      name: is_public ? "Public Show" : "Private Show",
      start_at: new Date(now.getTime() + 60 * 60 * 1000),
      end_at: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      is_public,
    });

  beforeEach(() => {
    repository = new EventInMemoryRepository();
    useCase = new ListEventsUseCase(repository);
  });

  it("scopes to establishment_id when provided, preserving is_public as given", async () => {
    const establishmentId = new Uuid().id;
    await repository.insert(buildEvent(establishmentId, true));
    await repository.insert(buildEvent(establishmentId, false));

    const output = await useCase.execute({ establishment_id: establishmentId });

    expect(output.items).toHaveLength(2);
  });

  it("forces is_public=true when establishment_id is absent (cross-establishment discovery)", async () => {
    const establishmentId = new Uuid().id;
    await repository.insert(buildEvent(establishmentId, true));
    await repository.insert(buildEvent(establishmentId, false));

    const output = await useCase.execute({});

    expect(output.items).toHaveLength(1);
    expect(output.items[0].name).toBe("Public Show");
  });

  it("overrides an explicit is_public=false when doing cross-establishment discovery", async () => {
    const establishmentId = new Uuid().id;
    await repository.insert(buildEvent(establishmentId, true));
    await repository.insert(buildEvent(establishmentId, false));

    const output = await useCase.execute({ filter: { is_public: false } as any });

    expect(output.items).toHaveLength(1);
    expect(output.items[0].name).toBe("Public Show");
  });
});
