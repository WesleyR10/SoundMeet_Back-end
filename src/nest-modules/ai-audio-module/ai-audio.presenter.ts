import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { AiAudioSeparationJobOutput } from "../../core/ai-audio/application/use-cases/common/ai-audio-separation-job-output";
import { AiAudioUploadOutput } from "../../core/ai-audio/application/use-cases/common/ai-audio-upload-output";

export class AiAudioUploadPresenter {
  id: string;
  musician_id: string;
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

  constructor(output: AiAudioUploadOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
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

export class AiAudioSeparationOutputPresenter {
  id: string;
  stem_name: string;
  object_key: string;
  public_url: string | null;
  content_type: string;
  file_size: number | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(output: AiAudioSeparationJobOutput["outputs"][number]) {
    this.id = output.id;
    this.stem_name = output.stem_name;
    this.object_key = output.object_key;
    this.public_url = output.public_url;
    this.content_type = output.content_type;
    this.file_size = output.file_size;
    this.created_at = output.created_at;
  }
}

export class AiAudioSeparationJobPresenter {
  id: string;
  ai_audio_upload_id: string;
  musician_id: string;
  model_id: string;
  output_prefix: string;
  output_format: "wav" | "flac" | "mp3" | null;
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
  @ApiProperty({ type: () => AiAudioSeparationOutputPresenter, isArray: true })
  outputs: AiAudioSeparationOutputPresenter[];
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: AiAudioSeparationJobOutput) {
    this.id = output.id;
    this.ai_audio_upload_id = output.ai_audio_upload_id;
    this.musician_id = output.musician_id;
    this.model_id = output.model_id;
    this.output_prefix = output.output_prefix;
    this.output_format = output.output_format;
    this.status = output.status;
    this.progress_percent = output.progress_percent;
    this.progress_stage = output.progress_stage;
    this.error_code = output.error_code;
    this.error_message = output.error_message;
    this.started_at = output.started_at;
    this.finished_at = output.finished_at;

    this.outputs = output.outputs.map(
      (o) => new AiAudioSeparationOutputPresenter(o),
    );
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}
