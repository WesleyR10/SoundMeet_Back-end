export type AiAudioUploadModel = {
  id: string;
  musicianId: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: string;
  multipart_upload_id: string | null;
  duration_seconds: number | null;
  codec: string | null;
  sample_rate: number | null;
  channels: number | null;
  status: string;
  rejected_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AiAudioSeparationOutputModel = {
  id: string;
  jobId: string;
  stem_name: string;
  object_key: string;
  content_type: string;
  file_size: number | null;
  created_at: Date;
};

export type AiAudioSeparationJobModel = {
  id: string;
  aiAudioUploadId: string;
  musicianId: string;
  model_id: string;
  output_prefix: string;
  output_format: string | null;
  status: string;
  progress_percent: number;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
  outputs?: AiAudioSeparationOutputModel[];
};
