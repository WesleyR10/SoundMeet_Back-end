import { SyncedLyricsBulkJob, SyncedLyricsBulkJobId } from "../../../domain";
import { SyncedLyricsBulkJobModel } from "./synced-lyrics-model";

export class SyncedLyricsBulkJobModelMapper {
  static toEntity(model: SyncedLyricsBulkJobModel): SyncedLyricsBulkJob {
    const status =
      model.status === "queued" ||
      model.status === "processing" ||
      model.status === "completed" ||
      model.status === "failed"
        ? model.status
        : "queued";

    const errorSummary =
      model.error_summary && typeof model.error_summary === "object"
        ? (model.error_summary as any)
        : null;

    return new SyncedLyricsBulkJob({
      synced_lyrics_bulk_job_id: new SyncedLyricsBulkJobId(model.id),
      musician_id: model.musicianId,
      status,
      total: model.total,
      processed: model.processed,
      success: model.success,
      failed: model.failed,
      error_summary: errorSummary,
      started_at: model.started_at,
      finished_at: model.finished_at,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }

  static toModel(entity: SyncedLyricsBulkJob) {
    return {
      id: entity.synced_lyrics_bulk_job_id.id,
      musicianId: entity.musician_id.id,
      status: entity.status,
      total: entity.total,
      processed: entity.processed,
      success: entity.success,
      failed: entity.failed,
      error_summary: entity.error_summary,
      started_at: entity.started_at,
      finished_at: entity.finished_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
