import { Musician, MusicianId } from "@core/musician/domain";
import { MusicianInMemoryRepository } from "@core/musician/infra/db/in-memory/musician-in-memory.repository";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { GetRequestSuggestionsInput } from "../get-request-suggestions.input";
import { GetRequestSuggestionsUseCase } from "../get-request-suggestions.use-case";

describe("GetRequestSuggestionsUseCase Unit Tests", () => {
  let useCase: GetRequestSuggestionsUseCase;
  let requestRepo: RequestInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;

  beforeEach(() => {
    requestRepo = new RequestInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    useCase = new GetRequestSuggestionsUseCase(requestRepo, musicianRepo);
  });

  test("should throw NotFoundError when musician does not exist", async () => {
    const input = new GetRequestSuggestionsInput({
      musician_id: new Uuid().id,
      limit: 5,
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  test("should return suggestions based on musician requests and related musicians", async () => {
    const musician_id = new Uuid().id;
    const related_musician_id = new Uuid().id;

    await musicianRepo.insert(
      Musician.create({
        musician_id: new MusicianId(musician_id),
        email: `${musician_id}@soundmeet.test`,
        name: "Main Musician",
        genres: ["rock"],
        instruments: ["guitar"],
      }),
    );

    await musicianRepo.insert(
      Musician.create({
        musician_id: new MusicianId(related_musician_id),
        email: `${related_musician_id}@soundmeet.test`,
        name: "Related Musician",
        genres: ["rock"],
        instruments: ["guitar"],
      }),
    );

    const event_id = new Uuid().id;
    const audience_id = new Uuid().id;

    await requestRepo.insert(
      Request.create({
        event_id,
        audience_id,
        musician_id,
        song_title: "Song A",
        artist: "Artist 1",
      }),
    );
    await requestRepo.insert(
      Request.create({
        event_id,
        audience_id,
        musician_id,
        song_title: "Song A",
        artist: "Artist 1",
      }),
    );
    await requestRepo.insert(
      Request.create({
        event_id,
        audience_id,
        musician_id,
        song_title: "Song B",
        artist: "Artist 2",
      }),
    );

    await requestRepo.insert(
      Request.create({
        event_id,
        audience_id,
        musician_id: related_musician_id,
        song_title: "Song C",
        artist: "Artist 3",
      }),
    );
    await requestRepo.insert(
      Request.create({
        event_id,
        audience_id,
        musician_id: related_musician_id,
        song_title: "Song C",
        artist: "Artist 3",
      }),
    );
    await requestRepo.insert(
      Request.create({
        event_id,
        audience_id,
        musician_id: related_musician_id,
        song_title: "Song C",
        artist: "Artist 3",
      }),
    );

    const output = await useCase.execute(
      new GetRequestSuggestionsInput({ musician_id, limit: 3 }),
    );

    expect(output.musician_id).toBe(musician_id);
    expect(output.genres).toEqual(["rock"]);
    expect(output.suggestions).toHaveLength(3);

    expect(output.suggestions.map((s) => [s.song_title, s.count])).toEqual([
      ["Song C", 3],
      ["Song A", 2],
      ["Song B", 1],
    ]);
  });
});
