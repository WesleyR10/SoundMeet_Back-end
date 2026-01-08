import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { DeleteRequestInput } from "../delete-request.input";
import { DeleteRequestUseCase } from "../delete-request.use-case";

describe("DeleteRequestUseCase Unit Tests", () => {
  let useCase: DeleteRequestUseCase;
  let repository: RequestInMemoryRepository;

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    useCase = new DeleteRequestUseCase(repository);
  });

  it("should throw error when entity not found", async () => {
    const requestId = new Uuid().id;
    const input = new DeleteRequestInput({ id: requestId });

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(requestId, Request),
    );
  });

  it("should delete a pending request", async () => {
    const request = Request.fake().aRequest().build();
    await repository.insert(request);

    const input = new DeleteRequestInput({ id: request.request_id.id });

    // Verify request exists before deletion
    const foundRequest = await repository.findById(request.request_id);
    expect(foundRequest).toBeDefined();

    await useCase.execute(input);

    // Verify request was deleted
    const deletedRequest = await repository.findById(request.request_id);
    expect(deletedRequest).toBeNull();
  });

  it("should delete an accepted request", async () => {
    const request = Request.fake().aRequest().build();
    request.accept();
    await repository.insert(request);

    const input = new DeleteRequestInput({ id: request.request_id.id });

    // Verify request exists before deletion
    const foundRequest = await repository.findById(request.request_id);
    expect(foundRequest).toBeDefined();
    expect(foundRequest!.isAccepted).toBe(true);

    await useCase.execute(input);

    // Verify request was deleted
    const deletedRequest = await repository.findById(request.request_id);
    expect(deletedRequest).toBeNull();
  });

  it("should delete a rejected request", async () => {
    const request = Request.fake().aRequest().build();
    request.reject("Not suitable for the venue");
    await repository.insert(request);

    const input = new DeleteRequestInput({ id: request.request_id.id });

    // Verify request exists before deletion
    const foundRequest = await repository.findById(request.request_id);
    expect(foundRequest).toBeDefined();
    expect(foundRequest!.isRejected).toBe(true);

    await useCase.execute(input);

    // Verify request was deleted
    const deletedRequest = await repository.findById(request.request_id);
    expect(deletedRequest).toBeNull();
  });

  it("should return void when deletion is successful", async () => {
    const request = Request.fake().aRequest().build();
    await repository.insert(request);

    const input = new DeleteRequestInput({ id: request.request_id.id });

    const result = await useCase.execute(input);

    expect(result).toBeUndefined();
  });

  it("should not affect other requests when deleting one", async () => {
    const request1 = Request.fake().aRequest().build();
    const request2 = Request.fake().aRequest().build();
    const request3 = Request.fake().aRequest().build();

    await repository.bulkInsert([request1, request2, request3]);

    const input = new DeleteRequestInput({ id: request2.request_id.id });

    await useCase.execute(input);

    // Verify only the target request was deleted
    const foundRequest1 = await repository.findById(request1.request_id);
    const deletedRequest2 = await repository.findById(request2.request_id);
    const foundRequest3 = await repository.findById(request3.request_id);

    expect(foundRequest1).toBeDefined();
    expect(deletedRequest2).toBeNull();
    expect(foundRequest3).toBeDefined();
  });

  it("should handle deletion with invalid UUID format", async () => {
    const invalidId = "invalid-uuid";
    const input = new DeleteRequestInput({ id: invalidId });

    // This should throw an InvalidUuidError since the UUID format is invalid
    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });
});
