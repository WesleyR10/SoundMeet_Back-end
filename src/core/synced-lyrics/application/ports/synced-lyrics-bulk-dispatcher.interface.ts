export type SyncedLyricsBulkEnqueueCommand = {
  job_id: string;
  musician_id: string;
  music_library_id: string;
  force?: boolean;
};

export interface ISyncedLyricsBulkDispatcher {
  enqueue(command: SyncedLyricsBulkEnqueueCommand): Promise<void>;
}
