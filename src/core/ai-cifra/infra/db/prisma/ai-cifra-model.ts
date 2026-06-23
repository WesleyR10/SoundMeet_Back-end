export type AiCifraUploadModel = {
  id: string;
  musicianId: string;
  musicLibraryId?: string | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: string;
  status: string;
  rejected_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AiCifraAnalysisJobModel = {
  id: string;
  aiCifraUploadId: string;
  musicianId: string;
  model_id: string;
  status: string;
  progress_percent: number;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  chords: any | null;
  segments: any | null;
  artifacts: any | null;
  created_at: Date;
  updated_at: Date;
};
