import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestStatusEnum } from "../../../../domain/value-objects/request-status.vo";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { GetRequestUseCase } from "../get-request.use-case";

describe("GetRequestUseCase Unit Tests", () => {
  let useCase: GetRequestUseCase;
  let repository: RequestInMemoryRepository;

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    useCase = new GetRequestUseCase(repository);
  });

  it("should throw an error when request is not found", async () => {
    const input = {
      id: new Uuid().id,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  describe("should get a request", () => {
    const arrange = [
      {
        request: {
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
          status: RequestStatusEnum.PENDING,
          rejection_reason: null,
          responded_at: null,
        },
      },
      {
        request: {
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
          status: RequestStatusEnum.PENDING,
          rejection_reason: null,
          responded_at: null,
        },
      },
      {
        request: {
          event_id: new Uuid().id,
          audience_id: new Uuid().id,
          musician_id: new Uuid().id,
          song_title: "Hotel California",
        },
        expected: {
          song_title: "Hotel California",
          artist: null,
          message: null,
          status: RequestStatusEnum.PENDING,
          rejection_reason: null,
          responded_at: null,
        },
      },
    ];

    test.each(arrange)("request: %j", async ({ request, expected }) => {
      const entity = Request.create(request);
      await repository.insert(entity);

      const input = {
        id: entity.request_id.id,
      };

      const output = await useCase.execute(input);

      expect(output.id).toBe(entity.request_id.id);
      expect(output.event_id).toBe(request.event_id);
      expect(output.audience_id).toBe(request.audience_id);
      expect(output.musician_id).toBe(request.musician_id);
      expect(output.song_title).toBe(expected.song_title);
      expect(output.artist).toBe(expected.artist);
      expect(output.message).toBe(expected.message);
      expect(output.status).toBe(RequestStatusEnum.PENDING);
      expect(output.rejection_reason).toBe(expected.rejection_reason);
      expect(output.responded_at).toBe(expected.responded_at);
      expect(output.created_at).toBeDefined();
      expect(output.age_in_minutes).toBeGreaterThanOrEqual(0);
      expect(output.is_pending).toBe(true);
      expect(output.is_accepted).toBe(false);
      expect(output.is_rejected).toBe(false);
    });
  });

  it("should get an accepted request", async () => {
    const request = Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Test Song",
      artist: "Test Artist",
      message: "Test message",
    });

    request.accept();
    await repository.insert(request);

    const input = {
      id: request.request_id.id,
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(request.request_id.id);
    expect(output.event_id).toBe(request.event_id.id);
    expect(output.status).toBe(RequestStatusEnum.ACCEPTED);
    expect(output.responded_at).toBeDefined();
    expect(output.is_accepted).toBe(true);
    expect(output.is_pending).toBe(false);
    expect(output.is_rejected).toBe(false);
  });

  it("should get a rejected request", async () => {
    const request = Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Test Song",
      artist: "Test Artist",
      message: "Test message",
    });

    const rejectionReason = "I don't know this song";
    request.reject(rejectionReason);
    await repository.insert(request);

    const input = {
      id: request.request_id.id,
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(request.request_id.id);
    expect(output.event_id).toBe(request.event_id.id);
    expect(output.status).toBe(RequestStatusEnum.REJECTED);
    expect(output.rejection_reason).toBe(rejectionReason);
    expect(output.responded_at).toBeDefined();
    expect(output.is_rejected).toBe(true);
    expect(output.is_pending).toBe(false);
    expect(output.is_accepted).toBe(false);
  });
});
