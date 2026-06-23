import { AggregateRoot, Uuid } from "../../shared/domain";
import { SyncedLyricsBulkJobValidatorFactory } from "./synced-lyrics-bulk-job.validator";
import { SyncedLyricsBulkJobFakeBuilder } from "./synced-lyrics-bulk-job-fake.builder";

export type SyncedLyricsBulkJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type SyncedLyricsBulkJobConstructorProps = {
  synced_lyrics_bulk_job_id?: SyncedLyricsBulkJobId;
  musician_id: string;
  status: SyncedLyricsBulkJobStatus;
  total?: number;
  processed?: number;
  success?: number;
  failed?: number;
  error_summary?: Record<string, number> | null;
  started_at?: Date | null;
  finished_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
};

export type SyncedLyricsBulkJobCreateCommand = {
  synced_lyrics_bulk_job_id?: SyncedLyricsBulkJobId;
  musician_id: string;
  total: number;
  status?: SyncedLyricsBulkJobStatus;
};

export class SyncedLyricsBulkJobId extends Uuid {}

export class SyncedLyricsBulkJob extends AggregateRoot {
  synced_lyrics_bulk_job_id: SyncedLyricsBulkJobId;
  musician_id: Uuid;
  status: SyncedLyricsBulkJobStatus;
  total: number;
  processed: number;
  success: number;
  failed: number;
  error_summary: Record<string, number> | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: SyncedLyricsBulkJobConstructorProps) {
    super();
    this.synced_lyrics_bulk_job_id =
      props.synced_lyrics_bulk_job_id ?? new SyncedLyricsBulkJobId();
    this.musician_id = new Uuid(props.musician_id);
    this.status = props.status;
    this.total = Math.max(0, Math.floor(props.total ?? 0));
    this.processed = Math.max(0, Math.floor(props.processed ?? 0));
    this.success = Math.max(0, Math.floor(props.success ?? 0));
    this.failed = Math.max(0, Math.floor(props.failed ?? 0));
    this.error_summary = props.error_summary ?? null;
    this.started_at = props.started_at ?? null;
    this.finished_at = props.finished_at ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): SyncedLyricsBulkJobId {
    return this.synced_lyrics_bulk_job_id;
  }

  static create(
    command: SyncedLyricsBulkJobCreateCommand,
  ): SyncedLyricsBulkJob {
    const job = new SyncedLyricsBulkJob({
      synced_lyrics_bulk_job_id: command.synced_lyrics_bulk_job_id,
      musician_id: command.musician_id,
      status: command.status ?? "queued",
      total: command.total,
      processed: 0,
      success: 0,
      failed: 0,
      error_summary: null,
      started_at: null,
      finished_at: null,
    });

    job.validate(["musician_id", "status", "total", "processed"]);
    return job;
  }

  start(): void {
    if (this.status === "completed" || this.status === "failed") {
      return;
    }
    this.status = "processing";
    this.started_at = this.started_at ?? new Date();
    this.updated_at = new Date();
    this.validate(["status", "started_at"]);
  }

  recordSuccess(): void {
    if (this.status !== "processing") {
      return;
    }
    this.processed += 1;
    this.success += 1;
    this.updated_at = new Date();
    this.validate(["processed", "success"]);
  }

  recordFailure(error_code: string): void {
    if (this.status !== "processing") {
      return;
    }
    this.processed += 1;
    this.failed += 1;

    const key = String(error_code ?? "FAILED")
      .trim()
      .slice(0, 128);
    const summary = this.error_summary ? { ...this.error_summary } : {};
    summary[key] = (summary[key] ?? 0) + 1;
    this.error_summary = summary;

    this.updated_at = new Date();
    this.validate(["processed", "failed"]);
  }

  complete(): void {
    if (this.status === "completed" || this.status === "failed") {
      return;
    }
    this.status = "completed";
    this.finished_at = new Date();
    this.updated_at = new Date();
    this.validate(["status", "finished_at"]);
  }

  fail(): void {
    if (this.status === "completed" || this.status === "failed") {
      return;
    }
    this.status = "failed";
    this.finished_at = new Date();
    this.updated_at = new Date();
    this.validate(["status", "finished_at"]);
  }

  validate(fields?: string[]): void {
    const validator = SyncedLyricsBulkJobValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  toJSON() {
    return {
      id: this.synced_lyrics_bulk_job_id.id,
      musician_id: this.musician_id.id,
      status: this.status,
      total: this.total,
      processed: this.processed,
      success: this.success,
      failed: this.failed,
      error_summary: this.error_summary,
      started_at: this.started_at,
      finished_at: this.finished_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake(): typeof SyncedLyricsBulkJobFakeBuilder {
    return SyncedLyricsBulkJobFakeBuilder;
  }
}
