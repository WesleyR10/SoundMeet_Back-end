import { Uuid } from "@core/shared/domain";
import { InvalidOperationError } from "@core/shared/domain/errors/invalid-operation.error";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

import { RequestSyncedLyricsBulkSyncUseCase } from "../request-synced-lyrics-bulk-sync.use-case";

describe("RequestSyncedLyricsBulkSyncUseCase Unit Tests", () => {
  it("should create a job and enqueue one command per music_library_id", async () => {
    const jobRepo = { insert: jest.fn().mockResolvedValue(undefined) } as any;
    const dispatcher = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;
    const useCase = new RequestSyncedLyricsBulkSyncUseCase(jobRepo, dispatcher);

    const musicianId = new Uuid().id;
    const ids = [new Uuid().id, new Uuid().id];

    const output = await useCase.execute({
      musician_id: musicianId,
      music_library_ids: ids,
      force: true,
    });

    expect(jobRepo.insert).toHaveBeenCalledTimes(1);
    expect(output.status).toBe("queued");
    expect(output.total).toBe(2);
    expect(dispatcher.enqueue).toHaveBeenCalledTimes(2);
    expect(dispatcher.enqueue).toHaveBeenCalledWith({
      job_id: output.id,
      musician_id: musicianId,
      music_library_id: ids[0],
      force: true,
    });
    expect(dispatcher.enqueue).toHaveBeenCalledWith({
      job_id: output.id,
      musician_id: musicianId,
      music_library_id: ids[1],
      force: true,
    });
  });

  it("should dedupe repeated music_library_ids before creating the job", async () => {
    const jobRepo = { insert: jest.fn().mockResolvedValue(undefined) } as any;
    const dispatcher = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;
    const useCase = new RequestSyncedLyricsBulkSyncUseCase(jobRepo, dispatcher);

    const repeatedId = new Uuid().id;

    const output = await useCase.execute({
      musician_id: new Uuid().id,
      music_library_ids: [repeatedId, repeatedId],
    });

    expect(output.total).toBe(1);
    expect(dispatcher.enqueue).toHaveBeenCalledTimes(1);
  });

  it("should throw EntityValidationError when music_library_ids is empty", async () => {
    const jobRepo = { insert: jest.fn() } as any;
    const dispatcher = { enqueue: jest.fn() } as any;
    const useCase = new RequestSyncedLyricsBulkSyncUseCase(jobRepo, dispatcher);

    await expect(
      useCase.execute({
        musician_id: new Uuid().id,
        music_library_ids: [],
      }),
    ).rejects.toBeInstanceOf(EntityValidationError);

    expect(jobRepo.insert).not.toHaveBeenCalled();
  });

  it("should throw EntityValidationError when musician_id is not a valid uuid", async () => {
    const jobRepo = { insert: jest.fn() } as any;
    const dispatcher = { enqueue: jest.fn() } as any;
    const useCase = new RequestSyncedLyricsBulkSyncUseCase(jobRepo, dispatcher);

    await expect(
      useCase.execute({
        musician_id: "not-a-uuid",
        music_library_ids: [new Uuid().id],
      }),
    ).rejects.toBeInstanceOf(EntityValidationError);

    expect(jobRepo.insert).not.toHaveBeenCalled();
  });

  it("should wrap dispatcher failures in InvalidOperationError after the job was already persisted", async () => {
    const jobRepo = { insert: jest.fn().mockResolvedValue(undefined) } as any;
    const dispatcher = {
      enqueue: jest.fn().mockRejectedValue(new Error("broker unavailable")),
    } as any;
    const useCase = new RequestSyncedLyricsBulkSyncUseCase(jobRepo, dispatcher);

    await expect(
      useCase.execute({
        musician_id: new Uuid().id,
        music_library_ids: [new Uuid().id],
      }),
    ).rejects.toBeInstanceOf(InvalidOperationError);

    expect(jobRepo.insert).toHaveBeenCalledTimes(1);
  });
});
