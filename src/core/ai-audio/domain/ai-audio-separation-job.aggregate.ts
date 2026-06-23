import { AggregateRoot, Uuid } from "../../shared/domain";
import { AiAudioSeparationJobValidatorFactory } from "./ai-audio-separation-job.validator";
import { AiAudioSeparationJobFakeBuilder } from "./ai-audio-separation-job-fake.builder";
import { AiAudioSeparationOutput } from "./ai-audio-separation-output.child-entity";

export type AiAudioSeparationJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type AiAudioSeparationJobConstructorProps = {
  ai_audio_separation_job_id?: AiAudioSeparationJobId;
  ai_audio_upload_id: string;
  musician_id: string;
  model_id: string;
  output_prefix: string;
  output_format?: "wav" | "flac" | "mp3" | null;
  status: AiAudioSeparationJobStatus;
  progress_percent?: number;
  progress_stage?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: Date | null;
  finished_at?: Date | null;
  outputs?: AiAudioSeparationOutput[];
  created_at?: Date;
  updated_at?: Date;
};

export type AiAudioSeparationJobCreateCommand = {
  ai_audio_separation_job_id?: AiAudioSeparationJobId;
  ai_audio_upload_id: string;
  musician_id: string;
  model_id: string;
  output_prefix: string;
  output_format?: "wav" | "flac" | "mp3" | null;
  status?: AiAudioSeparationJobStatus;
};

export class AiAudioSeparationJobId extends Uuid {}

export class AiAudioSeparationJob extends AggregateRoot {
  ai_audio_separation_job_id: AiAudioSeparationJobId;
  ai_audio_upload_id: Uuid;
  musician_id: Uuid;
  model_id: string;
  output_prefix: string;
  output_format: "wav" | "flac" | "mp3" | null;
  status: AiAudioSeparationJobStatus;
  progress_percent: number;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  outputs: AiAudioSeparationOutput[];
  created_at: Date;
  updated_at: Date;

  constructor(props: AiAudioSeparationJobConstructorProps) {
    super();
    this.ai_audio_separation_job_id =
      props.ai_audio_separation_job_id ?? new AiAudioSeparationJobId();
    this.ai_audio_upload_id = new Uuid(props.ai_audio_upload_id);
    this.musician_id = new Uuid(props.musician_id);
    this.model_id = props.model_id;
    this.output_prefix = props.output_prefix;
    this.output_format = props.output_format ?? null;
    this.status = props.status;
    this.progress_percent = props.progress_percent ?? 0;
    this.progress_stage = props.progress_stage ?? null;
    this.error_code = props.error_code ?? null;
    this.error_message = props.error_message ?? null;
    this.started_at = props.started_at ?? null;
    this.finished_at = props.finished_at ?? null;
    this.outputs = props.outputs ?? [];
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): AiAudioSeparationJobId {
    return this.ai_audio_separation_job_id;
  }

  static create(
    props: AiAudioSeparationJobCreateCommand,
  ): AiAudioSeparationJob {
    const job = new AiAudioSeparationJob({
      ...props,
      status: props.status ?? "queued",
    });
    job.validate([
      "ai_audio_upload_id",
      "musician_id",
      "model_id",
      "output_prefix",
      "output_format",
      "status",
    ]);
    return job;
  }

  start(): void {
    this.status = "processing";
    this.started_at = new Date();
    this.progress_percent = Math.max(this.progress_percent, 1);
    this.progress_stage = this.progress_stage ?? "starting";
    this.updated_at = new Date();
    this.validate([
      "status",
      "started_at",
      "progress_percent",
      "progress_stage",
    ]);
  }
  updateProgress(props: {
    progress_percent: number;
    progress_stage?: string | null;
    outputs?: AiAudioSeparationOutput[];
  }): void {
    const nextPercent = Number.isFinite(props.progress_percent)
      ? Math.floor(props.progress_percent)
      : 0;
    this.progress_percent = Math.min(
      100,
      Math.max(this.progress_percent, Math.max(0, nextPercent)),
    );
    if (props.progress_stage !== undefined) {
      this.progress_stage = props.progress_stage;
    }
    if (props.outputs?.length) {
      const byObjectKey = new Map(
        this.outputs.map((o) => [o.object_key, o] as const),
      );

      for (const incoming of props.outputs) {
        const existing = byObjectKey.get(incoming.object_key);
        if (existing) {
          existing.stem_name = incoming.stem_name;
          existing.content_type = incoming.content_type;
          existing.file_size = incoming.file_size;
          continue;
        }
        byObjectKey.set(incoming.object_key, incoming);
        this.outputs.push(incoming);
      }
    }
    this.updated_at = new Date();
    this.validate(["progress_percent", "progress_stage"]);
  }

  complete(outputs: AiAudioSeparationOutput[]): void {
    this.status = "completed";
    this.outputs = outputs;
    this.progress_percent = 100;
    this.progress_stage = "completed";
    this.finished_at = new Date();
    this.updated_at = new Date();
    this.validate([
      "status",
      "finished_at",
      "progress_percent",
      "progress_stage",
    ]);
  }

  fail(error_code: string, error_message: string): void {
    this.status = "failed";
    this.error_code = error_code;
    this.error_message = error_message;
    this.progress_stage = "failed";
    this.finished_at = new Date();
    this.updated_at = new Date();
    this.validate(["status", "error_code", "error_message", "finished_at"]);
  }

  requeue(error_code: string, error_message: string): void {
    this.status = "queued";
    this.error_code = error_code;
    this.error_message = error_message;
    this.started_at = null;
    this.finished_at = null;
    this.outputs = [];
    this.progress_percent = 0;
    this.progress_stage = null;
    this.updated_at = new Date();
    this.validate(["status", "error_code", "error_message", "started_at"]);
  }

  validate(fields?: string[]): void {
    const validator = AiAudioSeparationJobValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  toJSON() {
    return {
      id: this.ai_audio_separation_job_id.id,
      ai_audio_upload_id: this.ai_audio_upload_id.id,
      musician_id: this.musician_id.id,
      model_id: this.model_id,
      output_prefix: this.output_prefix,
      output_format: this.output_format,
      status: this.status,
      progress_percent: this.progress_percent,
      progress_stage: this.progress_stage,
      error_code: this.error_code,
      error_message: this.error_message,
      started_at: this.started_at,
      finished_at: this.finished_at,
      outputs: this.outputs.map((o) => o.toJSON()),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake(): typeof AiAudioSeparationJobFakeBuilder {
    return AiAudioSeparationJobFakeBuilder;
  }
}
