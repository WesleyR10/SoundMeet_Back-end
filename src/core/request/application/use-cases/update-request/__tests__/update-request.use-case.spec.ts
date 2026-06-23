import { Event, EventId } from "../../../../../events/domain";
import { EventInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-in-memory.repository";
import {
  Musician,
  MusicianId,
} from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { UpdateRequestInput } from "../update-request.input";
import { UpdateRequestUseCase } from "../update-request.use-case";

describe("UpdateRequestUseCase Unit Tests", () => {
  let useCase: UpdateRequestUseCase;
  let repository: RequestInMemoryRepository;
  let eventRepository: EventInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;

  const setupEventWithMusician = async (
    eventId: string,
    musicianId: string,
  ) => {
    const now = new Date();
    const event = new Event({
      event_id: new EventId(eventId),
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 60 * 60 * 1000),
      status: "active",
    });
    await eventRepository.insert(event);

    const musician = Musician.create({
      musician_id: new MusicianId(musicianId),
      email: `${musicianId}@soundmeet.test`,
      name: `Musician ${musicianId}`,
      genres: ["rock"],
      instruments: ["guitar"],
    });
    await musicianRepository.insert(musician);
    await eventRepository.addPerformer(new EventId(eventId), {
      musician_id: musicianId,
    });
  };

  const setupRequest = async () => {
    const eventId = new Uuid().id;
    const musicianId = new Uuid().id;
    await setupEventWithMusician(eventId, musicianId);
    const request = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: musicianId,
      song_title: "Test Song",
      artist: "Test Artist",
      message: "Test message",
    });
    return { request };
  };

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    eventRepository = new EventInMemoryRepository();
    musicianRepository = new MusicianInMemoryRepository();
    useCase = new UpdateRequestUseCase(
      repository,
      eventRepository,
      musicianRepository,
    );
  });

  it("should throw error when entity not found", async () => {
    const input = new UpdateRequestInput({
      id: new Uuid().id,
      song_title: "New Song",
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(input.id, Request),
    );
  });

  it("should throw error when trying to update non-pending request", async () => {
    const { request } = await setupRequest();
    request.accept(); // Make it non-pending
    await repository.insert(request);

    const input = new UpdateRequestInput({
      id: request.request_id.id,
      song_title: "New Song",
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("should update song_title of pending request", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const newSongTitle = "Updated Song Title";
    const input = new UpdateRequestInput({
      id: request.request_id.id,
      song_title: newSongTitle,
    });

    const output = await useCase.execute(input);

    expect(output.id).toBe(request.request_id.id);
    expect(output.song_title).toBe(newSongTitle);
    expect(output.artist).toBe(request.artist);
    expect(output.message).toBe(request.message?.value || null);

    const updatedEntity = await repository.findById(request.request_id);
    expect(updatedEntity!.song_title.value).toBe(newSongTitle);
  });

  it("should update artist of pending request", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const newArtist = "Updated Artist";
    const input = new UpdateRequestInput({
      id: request.request_id.id,
      artist: newArtist,
    });

    const output = await useCase.execute(input);

    expect(output.id).toBe(request.request_id.id);
    expect(output.artist).toBe(newArtist);
    expect(output.song_title).toBe(request.song_title.value);
    expect(output.message).toBe(request.message?.value || null);

    const updatedEntity = await repository.findById(request.request_id);
    expect(updatedEntity!.artist).toBe(newArtist);
  });

  it("should update message of pending request", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const newMessage = "Updated message content";
    const input = new UpdateRequestInput({
      id: request.request_id.id,
      message: newMessage,
    });

    const output = await useCase.execute(input);

    expect(output.id).toBe(request.request_id.id);
    expect(output.message).toBe(newMessage);
    expect(output.song_title).toBe(request.song_title.value);
    expect(output.artist).toBe(request.artist);

    const updatedEntity = await repository.findById(request.request_id);
    expect(updatedEntity!.message?.value).toBe(newMessage);
  });

  it("should update multiple fields of pending request", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const newSongTitle = "New Song";
    const newArtist = "New Artist";
    const newMessage = "New message";

    const input = new UpdateRequestInput({
      id: request.request_id.id,
      song_title: newSongTitle,
      artist: newArtist,
      message: newMessage,
    });

    const output = await useCase.execute(input);

    expect(output.id).toBe(request.request_id.id);
    expect(output.song_title).toBe(newSongTitle);
    expect(output.artist).toBe(newArtist);
    expect(output.message).toBe(newMessage);

    const updatedEntity = await repository.findById(request.request_id);
    expect(updatedEntity!.song_title.value).toBe(newSongTitle);
    expect(updatedEntity!.artist).toBe(newArtist);
    expect(updatedEntity!.message?.value).toBe(newMessage);
  });

  it("should not update fields when they are undefined", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const originalSongTitle = request.song_title;
    const originalArtist = request.artist;
    const originalMessage = request.message;

    const input = new UpdateRequestInput({
      id: request.request_id.id,
      // All fields undefined - should not change anything
    });

    const output = await useCase.execute(input);

    expect(output.id).toBe(request.request_id.id);
    expect(output.song_title).toBe(originalSongTitle.value);
    expect(output.artist).toBe(originalArtist);
    expect(output.message).toBe(originalMessage?.value || null);
  });

  it("should throw validation error for invalid song_title", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const input = new UpdateRequestInput({
      id: request.request_id.id,
      song_title: "", // Empty string should be invalid
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(
      "Song title must have at least 1 character",
    );
  });

  it("should throw validation error for invalid artist", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const input = new UpdateRequestInput({
      id: request.request_id.id,
      artist: "", // Empty string should be invalid
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("should preserve other request properties", async () => {
    const { request } = await setupRequest();
    await repository.insert(request);

    const originalStatus = request.status;
    const originalCreatedAt = request.created_at;
    const originalAudienceId = request.audience_id;
    const originalMusicianId = request.musician_id;

    const input = new UpdateRequestInput({
      id: request.request_id.id,
      song_title: "New Song Title",
    });

    const output = await useCase.execute(input);

    expect(output.status).toBe(originalStatus.value);
    expect(output.audience_id).toBe(originalAudienceId.id);
    expect(output.musician_id).toBe(originalMusicianId.id);
    // created_at should remain unchanged
    expect(new Date(output.created_at)).toEqual(originalCreatedAt);
  });
});
