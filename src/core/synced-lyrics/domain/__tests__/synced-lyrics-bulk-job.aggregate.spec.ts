import {
  InvalidUuidError,
  Uuid,
} from "../../../shared/domain/value-objects/uuid.vo";
import { SyncedLyricsBulkJob } from "../synced-lyrics-bulk-job.aggregate";

describe("SyncedLyricsBulkJob Unit Tests", () => {
  it("should create a job queued with zeroed counters", () => {
    const musicianId = new Uuid();
    const job = SyncedLyricsBulkJob.create({
      musician_id: musicianId.id,
      total: 3,
    });

    expect(job.notification.hasErrors()).toBe(false);
    expect(job.status).toBe("queued");
    expect(job.total).toBe(3);
    expect(job.processed).toBe(0);
    expect(job.success).toBe(0);
    expect(job.failed).toBe(0);
    expect(job.error_summary).toBeNull();
    expect(job.started_at).toBeNull();
    expect(job.finished_at).toBeNull();
  });

  it("should throw InvalidUuidError when musician_id is malformed (same as every other Uuid-backed aggregate)", () => {
    expect(() =>
      SyncedLyricsBulkJob.create({
        musician_id: "not-a-uuid",
        total: 1,
      }),
    ).toThrow(InvalidUuidError);
  });

  it("should include errors when total is negative-looking after clamping (out of range)", () => {
    const job = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 2_000_000,
    });

    expect(job.notification.hasErrors()).toBe(true);
  });

  it("start should move queued to processing and set started_at once", () => {
    const job = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 1,
    });

    job.start();
    expect(job.status).toBe("processing");
    expect(job.started_at).not.toBeNull();

    const startedAt = job.started_at;
    job.start();
    expect(job.started_at).toBe(startedAt);
  });

  it("start should be a no-op when job already completed or failed", () => {
    const completed = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 1,
    });
    completed.start();
    completed.recordSuccess();
    completed.complete();

    completed.start();
    expect(completed.status).toBe("completed");

    const failed = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 1,
    });
    failed.start();
    failed.fail();

    failed.start();
    expect(failed.status).toBe("failed");
  });

  it("recordSuccess should increment processed and success only while processing", () => {
    const job = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 2,
    });

    job.recordSuccess();
    expect(job.processed).toBe(0);
    expect(job.success).toBe(0);

    job.start();
    job.recordSuccess();
    expect(job.processed).toBe(1);
    expect(job.success).toBe(1);
    expect(job.failed).toBe(0);
  });

  it("recordFailure should increment processed and failed, and aggregate error_summary by code", () => {
    const job = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 3,
    });
    job.start();

    job.recordFailure("NOT_FOUND");
    job.recordFailure("NOT_FOUND");
    job.recordFailure("SYNC_FAILED");

    expect(job.processed).toBe(3);
    expect(job.failed).toBe(3);
    expect(job.success).toBe(0);
    expect(job.error_summary).toEqual({
      NOT_FOUND: 2,
      SYNC_FAILED: 1,
    });
  });

  it("complete should set status and finished_at, and be a no-op if already terminal", () => {
    const job = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 1,
    });
    job.start();
    job.recordSuccess();
    job.complete();

    expect(job.status).toBe("completed");
    expect(job.finished_at).not.toBeNull();

    const finishedAt = job.finished_at;
    job.complete();
    expect(job.finished_at).toBe(finishedAt);
  });

  it("fail should set status and finished_at, and be a no-op if already terminal", () => {
    const job = SyncedLyricsBulkJob.create({
      musician_id: new Uuid().id,
      total: 1,
    });
    job.start();
    job.fail();

    expect(job.status).toBe("failed");
    expect(job.finished_at).not.toBeNull();

    job.complete();
    expect(job.status).toBe("failed");
  });

  it("toJSON should expose the primitive shape of the job", () => {
    const musicianId = new Uuid();
    const job = SyncedLyricsBulkJob.create({
      musician_id: musicianId.id,
      total: 5,
    });

    expect(job.toJSON()).toMatchObject({
      id: job.synced_lyrics_bulk_job_id.id,
      musician_id: musicianId.id,
      status: "queued",
      total: 5,
      processed: 0,
      success: 0,
      failed: 0,
      error_summary: null,
    });
  });
});
