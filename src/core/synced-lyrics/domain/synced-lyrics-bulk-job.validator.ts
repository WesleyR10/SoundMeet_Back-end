import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import {
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobStatus,
} from "./synced-lyrics-bulk-job.aggregate";

export class SyncedLyricsBulkJobRules {
  @IsUUID("4", { groups: ["musician_id"] })
  @IsNotEmpty({ groups: ["musician_id"] })
  musician_id: string;

  @IsIn(["queued", "processing", "completed", "failed"], {
    groups: ["status"],
  })
  @IsNotEmpty({ groups: ["status"] })
  status: SyncedLyricsBulkJobStatus;

  @IsInt({ groups: ["total"] })
  @Min(0, { groups: ["total"] })
  @Max(1_000_000, { groups: ["total"] })
  total: number;

  @IsInt({ groups: ["processed"] })
  @Min(0, { groups: ["processed"] })
  @Max(1_000_000, { groups: ["processed"] })
  processed: number;

  @IsInt({ groups: ["success"] })
  @Min(0, { groups: ["success"] })
  @Max(1_000_000, { groups: ["success"] })
  success: number;

  @IsInt({ groups: ["failed"] })
  @Min(0, { groups: ["failed"] })
  @Max(1_000_000, { groups: ["failed"] })
  failed: number;

  @IsDate({ groups: ["started_at"] })
  @IsOptional({ groups: ["started_at"] })
  started_at?: Date;

  @IsDate({ groups: ["finished_at"] })
  @IsOptional({ groups: ["finished_at"] })
  finished_at?: Date;

  constructor(entity: SyncedLyricsBulkJob | any) {
    this.musician_id = entity?.musician_id?.id ?? entity?.musician_id;
    this.status = entity?.status;
    this.total = entity?.total;
    this.processed = entity?.processed;
    this.success = entity?.success;
    this.failed = entity?.failed;
    this.started_at = entity?.started_at ?? undefined;
    this.finished_at = entity?.finished_at ?? undefined;
  }
}

export class SyncedLyricsBulkJobValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["musician_id", "status", "total", "processed", "success", "failed"];

    return super.validate(
      notification,
      new SyncedLyricsBulkJobRules(data),
      newFields,
    );
  }
}

export class SyncedLyricsBulkJobValidatorFactory {
  static create(): SyncedLyricsBulkJobValidator {
    return new SyncedLyricsBulkJobValidator();
  }
}
