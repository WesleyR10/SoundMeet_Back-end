import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  ISyncedLyricsBulkJobRepository,
  SyncedLyricsBulkJob,
} from "../../../domain";
import { ISyncedLyricsBulkDispatcher } from "../../ports/synced-lyrics-bulk-dispatcher.interface";
import {
  SyncedLyricsBulkJobOutput,
  SyncedLyricsBulkJobOutputMapper,
} from "../common/synced-lyrics-bulk-job-output";
import {
  RequestSyncedLyricsBulkSyncInput,
  RequestSyncedLyricsBulkSyncInputConstructorProps,
  ValidateRequestSyncedLyricsBulkSyncInput,
} from "./request-synced-lyrics-bulk-sync.input";

export class RequestSyncedLyricsBulkSyncUseCase implements IUseCase<
  RequestSyncedLyricsBulkSyncInput,
  SyncedLyricsBulkJobOutput
> {
  constructor(
    private readonly jobRepo: ISyncedLyricsBulkJobRepository,
    private readonly dispatcher: ISyncedLyricsBulkDispatcher,
  ) {}

  async execute(
    input:
      | RequestSyncedLyricsBulkSyncInput
      | RequestSyncedLyricsBulkSyncInputConstructorProps,
  ): Promise<SyncedLyricsBulkJobOutput> {
    const validatedInput =
      input instanceof RequestSyncedLyricsBulkSyncInput
        ? input
        : new RequestSyncedLyricsBulkSyncInput(input);

    const errors =
      ValidateRequestSyncedLyricsBulkSyncInput.validate(validatedInput);
    if (errors.length) {
      const notification = new Notification();
      for (const error of errors as any[]) {
        const field = String(error?.property ?? "");
        const constraints = error?.constraints;
        if (constraints && typeof constraints === "object") {
          for (const message of Object.values(constraints)) {
            notification.addError(String(message), field || undefined);
          }
          continue;
        }
        notification.addError("Validation failed", field || undefined);
      }
      throw new EntityValidationError(notification.toJSON());
    }

    const ids = Array.from(
      new Set(
        (validatedInput.music_library_ids ?? [])
          .map((id) => `${id}`.trim())
          .filter(Boolean),
      ),
    );
    if (!ids.length) {
      const notification = new Notification();
      notification.addError(
        "music_library_ids deve ter ao menos 1 id",
        "music_library_ids",
      );
      throw new EntityValidationError(notification.toJSON());
    }

    const job = SyncedLyricsBulkJob.create({
      musician_id: validatedInput.musician_id,
      total: ids.length,
    });
    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    await this.jobRepo.insert(job);

    try {
      for (const musicLibraryId of ids) {
        await this.dispatcher.enqueue({
          job_id: job.synced_lyrics_bulk_job_id.id,
          musician_id: validatedInput.musician_id,
          music_library_id: musicLibraryId,
          force: validatedInput.force,
        });
      }
    } catch (e: any) {
      throw new InvalidOperationError(
        "Falha ao enfileirar bulk de synced lyrics",
        {
          cause: e,
          metadata: {
            job_id: job.synced_lyrics_bulk_job_id.id,
            musician_id: validatedInput.musician_id,
            total: ids.length,
          },
        },
      );
    }

    return SyncedLyricsBulkJobOutputMapper.toOutput(job);
  }
}
