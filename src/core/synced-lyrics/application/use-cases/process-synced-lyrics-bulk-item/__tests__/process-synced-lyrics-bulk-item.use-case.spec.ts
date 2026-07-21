import { Uuid } from "@core/shared/domain";
import { DomainError } from "@core/shared/domain/errors/domain.error";
import { NotFoundError } from "@core/shared/domain/errors/not-found.error";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

import { SyncedLyricsBulkJob } from "../../../../domain/synced-lyrics-bulk-job.aggregate";
import { ProcessSyncedLyricsBulkItemUseCase } from "../process-synced-lyrics-bulk-item.use-case";

describe("ProcessSyncedLyricsBulkItemUseCase Unit Tests", () => {
  const musicianId = new Uuid().id;
  const musicLibraryId = new Uuid().id;

  it("should throw NotFoundError when job does not exist", async () => {
    const jobRepo = {
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    } as any;
    const syncUseCase = { execute: jest.fn() } as any;
    const useCase = new ProcessSyncedLyricsBulkItemUseCase(
      jobRepo,
      syncUseCase,
    );

    await expect(
      useCase.execute({
        job_id: new Uuid().id,
        musician_id: musicianId,
        music_library_id: musicLibraryId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(syncUseCase.execute).not.toHaveBeenCalled();
  });

  it.each(["completed", "failed"] as const)(
    "should be a no-op when job is already %s",
    async (status) => {
      const job = SyncedLyricsBulkJob.fake()
        .aJob()
        .withMusicianId(new Uuid(musicianId))
        .withStatus(status)
        .withTotal(1)
        .build();

      const jobRepo = {
        findById: jest.fn().mockResolvedValue(job),
        update: jest.fn().mockResolvedValue(undefined),
      } as any;
      const syncUseCase = { execute: jest.fn() } as any;
      const useCase = new ProcessSyncedLyricsBulkItemUseCase(
        jobRepo,
        syncUseCase,
      );

      await useCase.execute({
        job_id: job.synced_lyrics_bulk_job_id.id,
        musician_id: musicianId,
        music_library_id: musicLibraryId,
      });

      expect(syncUseCase.execute).not.toHaveBeenCalled();
      expect(jobRepo.update).not.toHaveBeenCalled();
    },
  );

  it("should start a queued job, sync the item and record success", async () => {
    const job = SyncedLyricsBulkJob.fake()
      .aJob()
      .withMusicianId(new Uuid(musicianId))
      .withStatus("queued")
      .withTotal(2)
      .build();

    const jobRepo = {
      findById: jest.fn().mockResolvedValue(job),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;
    const syncUseCase = { execute: jest.fn().mockResolvedValue({}) } as any;
    const useCase = new ProcessSyncedLyricsBulkItemUseCase(
      jobRepo,
      syncUseCase,
    );

    await useCase.execute({
      job_id: job.synced_lyrics_bulk_job_id.id,
      musician_id: musicianId,
      music_library_id: musicLibraryId,
      force: true,
    });

    expect(syncUseCase.execute).toHaveBeenCalledWith({
      musician_id: musicianId,
      music_library_id: musicLibraryId,
      force: true,
    });
    expect(job.status).toBe("processing");
    expect(job.processed).toBe(1);
    expect(job.success).toBe(1);
    // total=2, processed=1 -> job not complete yet
    expect(jobRepo.update).toHaveBeenCalledTimes(2); // start() persisted, then the item result
  });

  it("should complete the job once the last item is processed", async () => {
    const job = SyncedLyricsBulkJob.fake()
      .aJob()
      .withMusicianId(new Uuid(musicianId))
      .withStatus("processing")
      .withTotal(1)
      .withProcessed(0)
      .build();

    const jobRepo = {
      findById: jest.fn().mockResolvedValue(job),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;
    const syncUseCase = { execute: jest.fn().mockResolvedValue({}) } as any;
    const useCase = new ProcessSyncedLyricsBulkItemUseCase(
      jobRepo,
      syncUseCase,
    );

    await useCase.execute({
      job_id: job.synced_lyrics_bulk_job_id.id,
      musician_id: musicianId,
      music_library_id: musicLibraryId,
    });

    expect(job.status).toBe("completed");
    expect(job.finished_at).not.toBeNull();
  });

  it.each([
    [new NotFoundError(musicLibraryId, {} as any), "NOT_FOUND"],
    [new EntityValidationError([{ lrc_raw: ["invalid"] }]), "VALIDATION_ERROR"],
    [new DomainError("boom"), "DOMAIN_ERROR"],
    [new Error("network timeout"), "SYNC_FAILED"],
  ])(
    "should record failure with the right error code for %#",
    async (thrown, expectedCode) => {
      const job = SyncedLyricsBulkJob.fake()
        .aJob()
        .withMusicianId(new Uuid(musicianId))
        .withStatus("processing")
        .withTotal(5)
        .build();

      const jobRepo = {
        findById: jest.fn().mockResolvedValue(job),
        update: jest.fn().mockResolvedValue(undefined),
      } as any;
      const syncUseCase = {
        execute: jest.fn().mockRejectedValue(thrown),
      } as any;
      const useCase = new ProcessSyncedLyricsBulkItemUseCase(
        jobRepo,
        syncUseCase,
      );

      await useCase.execute({
        job_id: job.synced_lyrics_bulk_job_id.id,
        musician_id: musicianId,
        music_library_id: musicLibraryId,
      });

      expect(job.processed).toBe(1);
      expect(job.failed).toBe(1);
      expect(job.error_summary).toEqual({ [expectedCode as string]: 1 });
    },
  );
});
