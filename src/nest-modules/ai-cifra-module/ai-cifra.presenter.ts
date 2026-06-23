import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { AiCifraAnalysisJobOutput } from "../../core/ai-cifra/application/use-cases/common/ai-cifra-analysis-job-output";
import { AiCifraUploadOutput } from "../../core/ai-cifra/application/use-cases/common/ai-cifra-upload-output";

export class AiCifraUploadPresenter {
  id: string;
  musician_id: string;
  music_library_id: string | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  public_url: string | null;
  status: string;
  rejected_reason: string | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: AiCifraUploadOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
    this.music_library_id = output.music_library_id;
    this.original_filename = output.original_filename;
    this.content_type = output.content_type;
    this.file_size = output.file_size;
    this.object_key = output.object_key;
    this.public_url = output.public_url;
    this.status = output.status;
    this.rejected_reason = output.rejected_reason;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class AiCifraAnalysisResultPresenter {
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  chords: any[];
  segments: any[];
  artifacts: any | null;

  constructor(output: NonNullable<AiCifraAnalysisJobOutput["result"]>) {
    this.bpm = output.bpm;
    this.key = output.key;
    this.time_signature = output.time_signature;
    this.chords = output.chords;
    this.segments = output.segments;
    this.artifacts = output.artifacts;
  }
}

export class AiCifraAnalysisJobPresenter {
  id: string;
  ai_cifra_upload_id: string;
  musician_id: string;
  model_id: string;
  status: string;
  progress_percent: number;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;

  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  started_at: Date | null;

  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  finished_at: Date | null;

  @ApiProperty({ type: () => AiCifraAnalysisResultPresenter, required: false })
  result: AiCifraAnalysisResultPresenter | null;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: AiCifraAnalysisJobOutput) {
    this.id = output.id;
    this.ai_cifra_upload_id = output.ai_cifra_upload_id;
    this.musician_id = output.musician_id;
    this.model_id = output.model_id;
    this.status = output.status;
    this.progress_percent = output.progress_percent;
    this.progress_stage = output.progress_stage;
    this.error_code = output.error_code;
    this.error_message = output.error_message;
    this.started_at = output.started_at;
    this.finished_at = output.finished_at;
    this.result = output.result
      ? new AiCifraAnalysisResultPresenter(output.result)
      : null;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}
