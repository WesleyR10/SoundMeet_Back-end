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
import { RequestStatus } from "../../../../domain/value-objects/request-status.vo";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import {
  RespondToRequestAction,
  RespondToRequestInput,
} from "../respond-to-request.input";
import { RespondToRequestUseCase } from "../respond-to-request.use-case";

describe("RespondToRequestUseCase Unit Tests", () => {
  let useCase: RespondToRequestUseCase;
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
      date: now,
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
    useCase = new RespondToRequestUseCase(
      repository,
      eventRepository,
      musicianRepository,
      60,
    );
  });

  it("should throw an error when request is not found", async () => {
    const input = new RespondToRequestInput({
      request_id: new Uuid().id,
      musician_id: new Uuid().id,
      action: RespondToRequestAction.ACCEPT,
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should throw an error when request is already responded", async () => {
    const { request } = await setupRequest();

    request.accept();
    await repository.insert(request);

    const input = new RespondToRequestInput({
      request_id: request.request_id.id,
      musician_id: request.musician_id.id,
      action: RespondToRequestAction.ACCEPT,
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  describe("should accept a request", () => {
    it("should accept a pending request", async () => {
      const { request } = await setupRequest();

      await repository.insert(request);

      const input = new RespondToRequestInput({
        request_id: request.request_id.id,
        musician_id: request.musician_id.id,
        action: RespondToRequestAction.ACCEPT,
      });

      const output = await useCase.execute(input);
      const updatedRequest = await repository.findById(request.request_id);

      expect(output.id).toBe(request.request_id.id);
      expect(output.event_id).toBe(request.event_id.id);
      expect(output.status).toBe("accepted");
      expect(output.rejection_reason).toBeNull();
      expect(output.responded_at).toBeDefined();

      expect(updatedRequest!.status).toEqual(RequestStatus.accepted());
      expect(updatedRequest!.rejection_reason).toBeNull();
      expect(updatedRequest!.responded_at).toBeDefined();
      expect(updatedRequest!.isAccepted).toBe(true);
      expect(updatedRequest!.isPending).toBe(false);
    });
  });

  describe("should reject a request", () => {
    it("should reject a pending request with reason", async () => {
      const { request } = await setupRequest();

      await repository.insert(request);

      const rejectionReason = "I don't know this song";
      const input = new RespondToRequestInput({
        request_id: request.request_id.id,
        musician_id: request.musician_id.id,
        action: RespondToRequestAction.REJECT,
        rejection_reason: rejectionReason,
      });

      const output = await useCase.execute(input);
      const updatedRequest = await repository.findById(request.request_id);

      expect(output.id).toBe(request.request_id.id);
      expect(output.event_id).toBe(request.event_id.id);
      expect(output.status).toBe("rejected");
      expect(output.rejection_reason).toBe(rejectionReason);
      expect(output.responded_at).toBeDefined();

      expect(updatedRequest!.status).toEqual(RequestStatus.rejected());
      expect(updatedRequest!.rejection_reason).toBe(rejectionReason);
      expect(updatedRequest!.responded_at).toBeDefined();
      expect(updatedRequest!.isRejected).toBe(true);
      expect(updatedRequest!.isPending).toBe(false);
    });
  });
});
