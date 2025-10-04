import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { RespondToRequestUseCase } from "../respond-to-request.use-case";
import {
  RespondToRequestAction,
  RespondToRequestInput,
} from "../respond-to-request.input";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Request } from "../../../../domain/request.aggregate";
import { RequestStatus } from "../../../../domain/value-objects/request-status.vo";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";

describe("RespondToRequestUseCase Unit Tests", () => {
  let useCase: RespondToRequestUseCase;
  let repository: RequestInMemoryRepository;

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    useCase = new RespondToRequestUseCase(repository);
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
    const request = Request.create({
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Test Song",
      artist: "Test Artist",
      message: "Test message",
    });

    request.accept();
    await repository.insert(request);

    const input = new RespondToRequestInput({
      request_id: request.entity_id.id,
      musician_id: request.musician_id.id,
      action: RespondToRequestAction.ACCEPT,
    });

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  describe("should accept a request", () => {
    it("should accept a pending request", async () => {
      const request = Request.create({
        audience_id: new Uuid().id,
        musician_id: new Uuid().id,
        song_title: "Test Song",
        artist: "Test Artist",
        message: "Test message",
      });

      await repository.insert(request);

      const input = new RespondToRequestInput({
        request_id: request.entity_id.id,
        musician_id: request.musician_id.id,
        action: RespondToRequestAction.ACCEPT,
      });

      const output = await useCase.execute(input);
      const updatedRequest = await repository.findById(request.entity_id);

      expect(output.id).toBe(request.entity_id.id);
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
      const request = Request.create({
        audience_id: new Uuid().id,
        musician_id: new Uuid().id,
        song_title: "Test Song",
        artist: "Test Artist",
        message: "Test message",
      });

      await repository.insert(request);

      const rejectionReason = "I don't know this song";
      const input = new RespondToRequestInput({
        request_id: request.entity_id.id,
        musician_id: request.musician_id.id,
        action: RespondToRequestAction.REJECT,
        rejection_reason: rejectionReason,
      });

      const output = await useCase.execute(input);
      const updatedRequest = await repository.findById(request.entity_id);

      expect(output.id).toBe(request.entity_id.id);
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
