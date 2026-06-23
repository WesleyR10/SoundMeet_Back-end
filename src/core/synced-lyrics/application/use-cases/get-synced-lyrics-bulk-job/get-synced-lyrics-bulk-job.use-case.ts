import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  ISyncedLyricsBulkJobRepository,
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobId,
} from "../../../domain";
import {
  SyncedLyricsBulkJobOutput,
  SyncedLyricsBulkJobOutputMapper,
} from "../common/synced-lyrics-bulk-job-output";
import {
  GetSyncedLyricsBulkJobInput,
  ValidateGetSyncedLyricsBulkJobInput,
} from "./get-synced-lyrics-bulk-job.input";

export class GetSyncedLyricsBulkJobUseCase implements IUseCase<
  GetSyncedLyricsBulkJobInput,
  SyncedLyricsBulkJobOutput
> {
  constructor(private readonly jobRepo: ISyncedLyricsBulkJobRepository) {}

  async execute(
    input: GetSyncedLyricsBulkJobInput | { id: string },
  ): Promise<SyncedLyricsBulkJobOutput> {
    const validatedInput =
      input instanceof GetSyncedLyricsBulkJobInput
        ? input
        : new GetSyncedLyricsBulkJobInput({ id: input.id });

    const errors = ValidateGetSyncedLyricsBulkJobInput.validate(validatedInput);
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

    const job = await this.jobRepo.findById(
      new SyncedLyricsBulkJobId(validatedInput.id),
    );
    if (!job) {
      throw new NotFoundError(validatedInput.id, SyncedLyricsBulkJob);
    }
    return SyncedLyricsBulkJobOutputMapper.toOutput(job);
  }
}
