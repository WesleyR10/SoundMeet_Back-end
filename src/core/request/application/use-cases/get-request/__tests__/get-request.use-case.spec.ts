import { Event, EventId } from "@core/events/domain";
import { EventInMemoryRepository } from "@core/events/infra/db/in-memory";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestStatusEnum } from "../../../../domain/value-objects/request-status.vo";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { GetRequestUseCase } from "../get-request.use-case";

describe("GetRequestUseCase Unit Tests", () => {
  let useCase: GetRequestUseCase;
  let repository: RequestInMemoryRepository;
  let eventRepo: EventInMemoryRepository;

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    eventRepo = new EventInMemoryRepository();
    useCase = new GetRequestUseCase(repository, eventRepo);
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

  describe("ownership scoping", () => {
    const buildRequest = () =>
      Request.create({
        event_id: new Uuid().id,
        audience_id: new Uuid().id,
        musician_id: new Uuid().id,
        song_title: "Song",
      });

    it("should allow the requesting audience to view their own request", async () => {
      const request = buildRequest();
      await repository.insert(request);

      const output = await useCase.execute({
        id: request.request_id.id,
        requesting_user_id: request.audience_id.id,
      });

      expect(output.id).toBe(request.request_id.id);
    });

    it("should allow the target musician to view the request", async () => {
      const request = buildRequest();
      await repository.insert(request);

      const output = await useCase.execute({
        id: request.request_id.id,
        requesting_user_id: request.musician_id.id,
      });

      expect(output.id).toBe(request.request_id.id);
    });

    it("should allow the establishment that owns the event to view the request", async () => {
      const establishment_id = new Uuid().id;
      const request = buildRequest();
      await repository.insert(request);
      await eventRepo.insert(
        new Event({
          event_id: new EventId(request.event_id.id),
          establishment_id: new Uuid(establishment_id),
          name: "Event",
          start_at: new Date(),
          end_at: new Date(Date.now() + 60 * 60 * 1000),
          status: "active",
        }),
      );

      const output = await useCase.execute({
        id: request.request_id.id,
        requesting_user_id: establishment_id,
      });

      expect(output.id).toBe(request.request_id.id);
    });

    it("should throw ForbiddenException for an unrelated user", async () => {
      const request = buildRequest();
      await repository.insert(request);

      await expect(() =>
        useCase.execute({
          id: request.request_id.id,
          requesting_user_id: new Uuid().id,
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("should allow admin regardless of ownership", async () => {
      const request = buildRequest();
      await repository.insert(request);

      const output = await useCase.execute({
        id: request.request_id.id,
        requesting_user_id: new Uuid().id,
        is_admin: true,
      });

      expect(output.id).toBe(request.request_id.id);
    });
  });
});
