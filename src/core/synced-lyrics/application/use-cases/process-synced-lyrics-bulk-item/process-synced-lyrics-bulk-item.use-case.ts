import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainError } from "../../../../shared/domain/errors/domain.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  ISyncedLyricsBulkJobRepository,
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobId,
} from "../../../domain";
import { SyncSyncedLyricsForMusicLibraryUseCase } from "../sync-synced-lyrics-for-music-library/sync-synced-lyrics-for-music-library.use-case";
import { ProcessSyncedLyricsBulkItemInput } from "./process-synced-lyrics-bulk-item.input";

export class ProcessSyncedLyricsBulkItemUseCase implements IUseCase<
  ProcessSyncedLyricsBulkItemInput,
  void
> {
  constructor(
    private readonly jobRepo: ISyncedLyricsBulkJobRepository,
    private readonly syncUseCase: SyncSyncedLyricsForMusicLibraryUseCase,
  ) {}

  async execute(input: ProcessSyncedLyricsBulkItemInput): Promise<void> {
    const job = await this.jobRepo.findById(
      new SyncedLyricsBulkJobId(input.job_id),
    );
    if (!job) {
      throw new NotFoundError(input.job_id, SyncedLyricsBulkJob);
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    if (job.status === "queued") {
      job.start();
      if (job.notification.hasErrors()) {
        throw new EntityValidationError(job.notification.toJSON());
      }
      await this.jobRepo.update(job);
    }

    try {
      await this.syncUseCase.execute({
        musician_id: input.musician_id,
        music_library_id: input.music_library_id,
        force: input.force,
      } as any);

      job.recordSuccess();
    } catch (e: any) {
      const errorCode =
        e instanceof NotFoundError
          ? "NOT_FOUND"
          : e instanceof EntityValidationError
            ? "VALIDATION_ERROR"
            : e instanceof DomainError
              ? "DOMAIN_ERROR"
              : "SYNC_FAILED";

      job.recordFailure(errorCode);
    }

    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    if (job.processed >= job.total) {
      job.complete();
      if (job.notification.hasErrors()) {
        throw new EntityValidationError(job.notification.toJSON());
      }
    }

    await this.jobRepo.update(job);
  }
}
