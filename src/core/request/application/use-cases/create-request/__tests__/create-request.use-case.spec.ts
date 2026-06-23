import { Audience, AudienceId } from "@core/audience/domain";
import { AudienceInMemoryRepository } from "@core/audience/infra/db/in-memory/audience-in-memory.repository";
import { Event, EventId } from "@core/events/domain";
import { EventInMemoryRepository } from "@core/events/infra/db/in-memory";
import { Musician, MusicianId } from "@core/musician/domain";
import { MusicianInMemoryRepository } from "@core/musician/infra/db/in-memory/musician-in-memory.repository";

import { FakeClock } from "../../../../../shared/application/clock.interface";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { InvalidUuidError } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request, RequestId } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { CreateRequestInput } from "../create-request.input";
import { CreateRequestUseCase } from "../create-request.use-case";

describe("CreateRequestUseCase Unit Tests", () => {
  let useCase: CreateRequestUseCase;
  let repository: RequestInMemoryRepository;
  let eventRepository: EventInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;
  let audienceRepository: AudienceInMemoryRepository;
  const now = new Date("2026-01-01T10:00:00.000Z");
  const clock = new FakeClock(now);

  const setupEventWithMusicians = async (
    eventId: string,
    musicianIds: string[],
  ) => {
    const now = clock.now();
    const event = new Event({
      event_id: new EventId(eventId),
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 60 * 60 * 1000),
      status: "active",
    });
    await eventRepository.insert(event);

    for (const musicianId of musicianIds) {
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
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    repository = new RequestInMemoryRepository();
    eventRepository = new EventInMemoryRepository();
    musicianRepository = new MusicianInMemoryRepository();
    audienceRepository = new AudienceInMemoryRepository();
    useCase = new CreateRequestUseCase(
      repository,
      eventRepository,
      musicianRepository,
      audienceRepository,
      10,
      120,
      clock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should throw an error when aggregate is not valid", async () => {
    const input: CreateRequestInput = {
      event_id: "invalid-uuid",
      audience_id: "invalid-uuid",
      musician_id: "invalid-uuid",
      song_title: "",
      artist: "Test Artist",
      message: "Test message",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  test.each([
    {
      scenario: "daily limit is exceeded",
      arrange: async () => {
        const eventId = new Uuid().id;
        const audienceId = new Uuid().id;
        const musicianId = new Uuid().id;

        await setupEventWithMusicians(eventId, [musicianId]);
        await audienceRepository.insert(
          new Audience({
            audience_id: new AudienceId(audienceId),
            email: `${audienceId}@soundmeet.test`,
            name: "Audience",
            is_active: true,
          }),
        );
        await eventRepository.addAttendee(new EventId(eventId), audienceId);

        for (let i = 0; i < 10; i++) {
          const request = new Request({
            event_id: eventId,
            audience_id: audienceId,
            musician_id: new Uuid().id,
            song_title: `Song ${i}`,
            artist: "Artist",
            message: "Message",
            created_at: clock.now(),
          });
          await repository.insert(request);
        }

        return {
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: "New Song",
          artist: "New Artist",
          message: "New message",
        };
      },
    },
    {
      scenario: "pending request exists for same musician",
      arrange: async () => {
        const eventId = new Uuid().id;
        const audienceId = new Uuid().id;
        const musicianId = new Uuid().id;

        await setupEventWithMusicians(eventId, [musicianId]);
        await audienceRepository.insert(
          new Audience({
            audience_id: new AudienceId(audienceId),
            email: `${audienceId}@soundmeet.test`,
            name: "Audience",
            is_active: true,
          }),
        );
        await eventRepository.addAttendee(new EventId(eventId), audienceId);

        await repository.insert(
          Request.create({
            event_id: eventId,
            audience_id: audienceId,
            musician_id: musicianId,
            song_title: "Existing Song",
            artist: "Existing Artist",
            message: "Existing message",
          }),
        );

        return {
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: "New Song",
          artist: "New Artist",
          message: "New message",
        };
      },
    },
    {
      scenario: "similar recent request exists for same musician",
      arrange: async () => {
        const eventId = new Uuid().id;
        const audienceId = new Uuid().id;
        const musicianId = new Uuid().id;
        const songTitle = "Same Song";

        await setupEventWithMusicians(eventId, [musicianId]);
        await audienceRepository.insert(
          new Audience({
            audience_id: new AudienceId(audienceId),
            email: `${audienceId}@soundmeet.test`,
            name: "Audience",
            is_active: true,
          }),
        );
        await eventRepository.addAttendee(new EventId(eventId), audienceId);

        await repository.insert(
          new Request({
            event_id: eventId,
            audience_id: audienceId,
            musician_id: musicianId,
            song_title: songTitle,
            artist: "Same Artist",
            message: "Message",
            created_at: now,
          }),
        );

        return {
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: songTitle,
          artist: "Same Artist",
          message: "New message",
        };
      },
    },
  ])(
    "should throw EntityValidationError when $scenario",
    async ({ arrange }) => {
      const input = await arrange();
      await expect(() => useCase.execute(input)).rejects.toThrow(
        EntityValidationError,
      );
    },
  );

  it("should allow similar request for a different musician in the last 2 hours", async () => {
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;
    const songTitle = "Same Song";
    const differentMusicianId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId, differentMusicianId]);
    await audienceRepository.insert(
      new Audience({
        audience_id: new AudienceId(audienceId),
        email: `${audienceId}@soundmeet.test`,
        name: "Audience",
        is_active: true,
      }),
    );
    await eventRepository.addAttendee(new EventId(eventId), audienceId);

    // Create a recent request with the same song for one musician
    const existingRequest = new Request({
      event_id: eventId,
      audience_id: audienceId,
      musician_id: musicianId,
      song_title: songTitle,
      artist: "Same Artist",
      message: "Message",
      created_at: clock.now(),
    });
    await repository.insert(existingRequest);

    const input = {
      event_id: eventId,
      audience_id: audienceId,
      musician_id: differentMusicianId,
      song_title: songTitle,
      artist: "Same Artist",
      message: "New message",
    };

    const output = await useCase.execute(input);
    const createdRequest = await repository.findById(new RequestId(output.id));

    expect(createdRequest).toBeInstanceOf(Request);
    expect(createdRequest!.musician_id.id).toBe(input.musician_id);
  });

  describe("should create a request", () => {
    const arrange = [
      {
        input: {
          event_id: new Uuid().id,
          audience_id: new Uuid().id,
          musician_id: new Uuid().id,
          song_title: "Bohemian Rhapsody",
          artist: "Queen",
          message: "Please play this classic!",
        },
        expected: {
          song_title: "Bohemian Rhapsody",
          artist: "Queen",
          message: "Please play this classic!",
          status: "pending",
          rejection_reason: null,
          responded_at: null,
        },
      },
      {
        input: {
          event_id: new Uuid().id,
          audience_id: new Uuid().id,
          musician_id: new Uuid().id,
          song_title: "Imagine",
          artist: "John Lennon",
        },
        expected: {
          song_title: "Imagine",
          artist: "John Lennon",
          message: null,
          status: "pending",
          rejection_reason: null,
          responded_at: null,
        },
      },
      {
        input: {
          event_id: new Uuid().id,
          audience_id: new Uuid().id,
          musician_id: new Uuid().id,
          song_title: "Hotel California",
        },
        expected: {
          song_title: "Hotel California",
          artist: null,
          message: null,
          status: "pending",
          rejection_reason: null,
          responded_at: null,
        },
      },
    ];

    test.each(arrange)("input: %j", async ({ input, expected }) => {
      await setupEventWithMusicians(input.event_id, [input.musician_id]);
      await audienceRepository.insert(
        new Audience({
          audience_id: new AudienceId(input.audience_id),
          email: `${input.audience_id}@soundmeet.test`,
          name: "Audience",
          is_active: true,
        }),
      );
      await eventRepository.addAttendee(
        new EventId(input.event_id),
        input.audience_id,
      );
      const output = await useCase.execute(input);
      const entity = await repository.findById(new RequestId(output.id));

      expect(output.id).toBeDefined();
      expect(output.event_id).toBe(input.event_id);
      expect(output.audience_id).toBe(input.audience_id);
      expect(output.musician_id).toBe(input.musician_id);
      expect(output.song_title).toBe(expected.song_title);
      expect(output.artist).toBe(expected.artist);
      expect(output.message).toBe(expected.message);
      expect(output.status).toBe(expected.status);
      expect(output.rejection_reason).toBe(expected.rejection_reason);
      expect(output.responded_at).toBe(expected.responded_at);
      expect(output.created_at).toBeDefined();

      expect(entity!.toJSON()).toStrictEqual({
        request_id: output.id,
        event_id: input.event_id,
        audience_id: input.audience_id,
        musician_id: input.musician_id,
        library_id: null,
        song_title: expected.song_title,
        artist: expected.artist,
        message: expected.message,
        status: expected.status,
        rejection_reason: expected.rejection_reason,
        votes_count: 0,
        played_at: null,
        created_at: output.created_at,
        updated_at: output.created_at,
        responded_at: expected.responded_at,
        is_pending: true,
        is_accepted: false,
        is_rejected: false,
        is_played: false,
        is_responded: false,
        has_message: expected.message !== null,
        display_title: expected.artist
          ? `${expected.song_title} - ${expected.artist}`
          : expected.song_title,
        age_in_minutes: expect.any(Number),
        is_recent: true,
        is_old: false,
        is_urgent: false,
        priority: expect.any(String),
        points_value: expect.any(Object),
        can_be_accepted: true,
        can_be_rejected: true,
        is_within_response_time: true,
      });
    });
  });
});
