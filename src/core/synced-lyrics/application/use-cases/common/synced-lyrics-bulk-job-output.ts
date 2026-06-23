import { SyncedLyricsBulkJob } from "../../../domain/synced-lyrics-bulk-job.aggregate";

export type SyncedLyricsBulkJobOutput = {
  id: string;
  musician_id: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  error_summary: Record<string, number> | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class SyncedLyricsBulkJobOutputMapper {
  static toOutput(entity: SyncedLyricsBulkJob): SyncedLyricsBulkJobOutput {
    return {
      id: entity.synced_lyrics_bulk_job_id.id,
      musician_id: entity.musician_id.id,
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
