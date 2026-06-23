import { Event, EventId } from "@core/events/domain";
import { EventInMemoryRepository } from "@core/events/infra/db/in-memory";
import { Musician, MusicianId } from "@core/musician/domain";
import { MusicianInMemoryRepository } from "@core/musician/infra/db/in-memory/musician-in-memory.repository";

import { FakeClock } from "../../../../../shared/application/clock.interface";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request, RequestId } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { MarkRequestPlayedInput } from "../mark-request-played.input";
import { MarkRequestPlayedUseCase } from "../mark-request-played.use-case";

describe("MarkRequestPlayedUseCase Unit Tests", () => {
  let useCase: MarkRequestPlayedUseCase;
  let requestRepo: RequestInMemoryRepository;
  let eventRepo: EventInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  const now = new Date("2026-01-01T00:00:00.000Z");
  const clock = new FakeClock(now);

  beforeEach(() => {
    requestRepo = new RequestInMemoryRepository();
    eventRepo = new EventInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    useCase = new MarkRequestPlayedUseCase(
      requestRepo,
      eventRepo,
      musicianRepo,
      clock,
    );
  });

  test("should mark an accepted request as played", async () => {
    const event_id = new Uuid().id;
    const musician_id = new Uuid().id;
    const audience_id = new Uuid().id;

    const eventNow = clock.now();
    await eventRepo.insert(
      new Event({
        event_id: new EventId(event_id),
        establishment_id: new Uuid(),
        name: "Event",
        start_at: eventNow,
        end_at: new Date(eventNow.getTime() + 60 * 60 * 1000),
        status: "active",
      }),
    );

    await musicianRepo.insert(
      Musician.create({
        musician_id: new MusicianId(musician_id),
        email: `${musician_id}@soundmeet.test`,
        name: "Musician",
        genres: ["rock"],
        instruments: ["guitar"],
      }),
    );

    await eventRepo.addPerformer(new EventId(event_id), { musician_id });

    const request = Request.create({
      event_id,
      audience_id,
      musician_id,
      song_title: "Song",
    });
    request.accept();
    await requestRepo.insert(request);

    const output = await useCase.execute(
      new MarkRequestPlayedInput({ request_id: request.request_id.id }),
    );

    expect(output.id).toBe(request.request_id.id);
    expect(output.status).toBe("played");
    expect(output.played_at).toBeInstanceOf(Date);
    expect(output.played_at).toEqual(now);

    const updated = await requestRepo.findById(new RequestId(output.id));
    expect(updated?.status.value).toBe("played");
  });

  test("should throw when request is pending", async () => {
    const event_id = new Uuid().id;
    const musician_id = new Uuid().id;
    const audience_id = new Uuid().id;

    const eventNow = clock.now();
    await eventRepo.insert(
      new Event({
        event_id: new EventId(event_id),
        establishment_id: new Uuid(),
        name: "Event",
        start_at: eventNow,
        end_at: new Date(eventNow.getTime() + 60 * 60 * 1000),
        status: "active",
      }),
    );

    await musicianRepo.insert(
      Musician.create({
        musician_id: new MusicianId(musician_id),
        email: `${musician_id}@soundmeet.test`,
        name: "Musician",
        genres: ["rock"],
        instruments: ["guitar"],
      }),
    );

    await eventRepo.addPerformer(new EventId(event_id), { musician_id });

    const request = Request.create({
      event_id,
      audience_id,
      musician_id,
      song_title: "Song",
    });
    await requestRepo.insert(request);

    await expect(() =>
      useCase.execute(
        new MarkRequestPlayedInput({ request_id: request.request_id.id }),
      ),
    ).rejects.toThrow(EntityValidationError);
  });
});
