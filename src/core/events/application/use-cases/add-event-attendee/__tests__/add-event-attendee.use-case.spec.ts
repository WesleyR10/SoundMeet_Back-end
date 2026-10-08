import { Event, EventId, PresenceVerifier } from "@core/events/domain";
import { EventInMemoryRepository } from "@core/events/infra/db/in-memory";
import { VenueLocationInMemoryAdapter } from "@core/events/infra/venue-location";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { AddEventAttendeeUseCase } from "../add-event-attendee.use-case";

describe("AddEventAttendeeUseCase — presença verificada", () => {
  const VENUE = { latitude: -22.9068, longitude: -43.1729 };
  const NEAR = { latitude: -22.9058, longitude: -43.1729, accuracy_m: 15 };
  const FAR = { latitude: -23.5505, longitude: -46.6333, accuracy_m: 15 };

  let eventRepo: EventInMemoryRepository;
  let venueLocation: VenueLocationInMemoryAdapter;
  let useCase: AddEventAttendeeUseCase;

  const makeEvent = async (status: "scheduled" | "active" = "active") => {
    const now = new Date();
    const event = new Event({
      event_id: new EventId(),
      establishment_id: new Uuid(),
      name: "Roda de samba",
      start_at: now,
      end_at: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      status,
    });
    await eventRepo.insert(event);
    return event;
  };

  const base = (event: Event, audience_id = new Uuid().id) => ({
    establishment_id: event.establishment_id.id,
    event_id: event.event_id.id,
    audience_id,
  });

  beforeEach(() => {
    eventRepo = new EventInMemoryRepository();
    venueLocation = new VenueLocationInMemoryAdapter();
    useCase = new AddEventAttendeeUseCase(
      eventRepo,
      venueLocation,
      new PresenceVerifier(),
    );
  });

  it("registra o fã dentro do raio, com método `geo` e distância", async () => {
    const event = await makeEvent();
    venueLocation.set(event.establishment_id.id, VENUE);
    const audienceId = new Uuid().id;

    await useCase.execute({
      ...base(event, audienceId),
      registered_by: "audience",
      location: NEAR,
    });

    expect(await eventRepo.isAudienceAttendee(event.event_id, audienceId)).toBe(
      true,
    );
    expect(
      eventRepo.presences.get(`${event.event_id.id}:${audienceId}`),
    ).toMatchObject({
      method: "geo",
      distance_m: 111,
    });
  });

  it("recusa o fã longe da casa e NÃO o conta como presente", async () => {
    const event = await makeEvent();
    venueLocation.set(event.establishment_id.id, VENUE);
    const audienceId = new Uuid().id;

    await expect(
      useCase.execute({
        ...base(event, audienceId),
        registered_by: "audience",
        location: FAR,
      }),
    ).rejects.toThrow(EntityValidationError);
    expect(await eventRepo.isAudienceAttendee(event.event_id, audienceId)).toBe(
      false,
    );
  });

  it("recusa o fã sem leitura de GPS", async () => {
    const event = await makeEvent();
    venueLocation.set(event.establishment_id.id, VENUE);

    await expect(
      useCase.execute({ ...base(event), registered_by: "audience" }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("recusa check-in do fã em evento que não está ao vivo", async () => {
    const event = await makeEvent("scheduled");
    venueLocation.set(event.establishment_id.id, VENUE);

    await expect(
      useCase.execute({
        ...base(event),
        registered_by: "audience",
        location: NEAR,
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("aceita o fã em casa sem coordenada, marcando o método", async () => {
    const event = await makeEvent();
    const audienceId = new Uuid().id;

    await useCase.execute({
      ...base(event, audienceId),
      registered_by: "audience",
    });

    expect(
      eventRepo.presences.get(`${event.event_id.id}:${audienceId}`),
    ).toMatchObject({
      method: "venue_without_coords",
      distance_m: null,
    });
  });

  it("deixa a casa registrar alguém sem GPS (liberação manual)", async () => {
    const event = await makeEvent("scheduled");
    venueLocation.set(event.establishment_id.id, VENUE);
    const audienceId = new Uuid().id;

    await useCase.execute({
      ...base(event, audienceId),
      registered_by: "establishment",
    });

    expect(
      eventRepo.presences.get(`${event.event_id.id}:${audienceId}`),
    ).toMatchObject({
      method: "establishment",
    });
  });

  it("refazer o check-in no local renova a verificação sem contar duas vezes", async () => {
    const event = await makeEvent();
    venueLocation.set(event.establishment_id.id, VENUE);
    const audienceId = new Uuid().id;
    const input = {
      ...base(event, audienceId),
      registered_by: "audience" as const,
      location: NEAR,
    };

    await useCase.execute(input);
    const output = await useCase.execute(input);

    expect(output.current_capacity).toBe(1);
  });

  it("não aceita evento de outra casa", async () => {
    const event = await makeEvent();

    await expect(
      useCase.execute({
        ...base(event),
        establishment_id: new Uuid().id,
        registered_by: "establishment",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
