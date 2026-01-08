import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { InvalidUuidError } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request, RequestId } from "../../../../domain/request.aggregate";
import { RequestStatus } from "../../../../domain/value-objects/request-status.vo";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { CreateRequestInput } from "../create-request.input";
import { CreateRequestUseCase } from "../create-request.use-case";

describe("CreateRequestUseCase Unit Tests", () => {
  let useCase: CreateRequestUseCase;
  let repository: RequestInMemoryRepository;

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    useCase = new CreateRequestUseCase(repository);
  });

  it("should throw an error when aggregate is not valid", async () => {
    const input: CreateRequestInput = {
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

  it("should throw an error when daily limit is exceeded", async () => {
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;

    // Create 10 requests (daily limit)
    for (let i = 0; i < 10; i++) {
      const request = Request.create({
        audience_id: audienceId,
        musician_id: new Uuid().id,
        song_title: `Song ${i}`,
        artist: "Artist",
        message: "Message",
      });
      await repository.insert(request);
    }

    const input = {
      audience_id: audienceId,
      musician_id: musicianId,
      song_title: "New Song",
      artist: "New Artist",
      message: "New message",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("should throw an error when there is a pending request for the same musician", async () => {
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;

    // Create a pending request for the same musician
    const existingRequest = Request.create({
      audience_id: audienceId,
      musician_id: musicianId,
      song_title: "Existing Song",
      artist: "Existing Artist",
      message: "Existing message",
    });
    await repository.insert(existingRequest);

    const input = {
      audience_id: audienceId,
      musician_id: musicianId,
      song_title: "New Song",
      artist: "New Artist",
      message: "New message",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("should throw an error when there is a similar request in the last 2 hours", async () => {
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;
    const songTitle = "Same Song";

    // Create a recent request with the same song
    const existingRequest = Request.create({
      audience_id: audienceId,
      musician_id: musicianId,
      song_title: songTitle,
      artist: "Same Artist",
      message: "Message",
    });
    await repository.insert(existingRequest);

    const input = {
      audience_id: audienceId,
      musician_id: new Uuid().id, // Different musician
      song_title: songTitle,
      artist: "Same Artist",
      message: "New message",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  describe("should create a request", () => {
    const arrange = [
      {
        input: {
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
      const output = await useCase.execute(input);
      const entity = await repository.findById(new RequestId(output.id));

      expect(output.id).toBeDefined();
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
        audience_id: input.audience_id,
        musician_id: input.musician_id,
        song_title: expected.song_title,
        artist: expected.artist,
        message: expected.message,
        status: expected.status,
        rejection_reason: expected.rejection_reason,
        responded_at: expected.responded_at,
        created_at: output.created_at,
        age_in_minutes: expect.any(Number),
        priority: expect.any(String),
        points_value: expect.any(Object),
        is_pending: true,
        is_accepted: false,
        is_rejected: false,
        can_be_accepted: true,
        can_be_rejected: true,
        display_title: expected.artist
          ? `${expected.song_title} - ${expected.artist}`
          : expected.song_title,
        has_message: expected.message !== null,
        is_old: false,
        is_recent: true,
        is_responded: false,
        is_urgent: false,
        is_within_response_time: true,
      });
    });
  });
});
