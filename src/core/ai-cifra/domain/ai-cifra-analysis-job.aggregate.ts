import { AggregateRoot, Uuid, ValueObject } from "../../shared/domain";
import { AiCifraAnalysisJobValidatorFactory } from "./ai-cifra-analysis-job.validator";
import { AiCifraAnalysisJobFakeBuilder } from "./ai-cifra-analysis-job-fake.builder";

export type AiCifraAnalysisJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type AiCifraChordSegment = {
  start_seconds: number;
  end_seconds: number;
  chord: string;
  confidence?: number | null;
};

export type AiCifraStructureSegment = {
  start_seconds: number;
  end_seconds: number;
  label: string;
  confidence?: number | null;
};

export type AiCifraAnalysisArtifacts = Record<string, any>;

export type AiCifraAnalysisResultConstructorProps = {
  bpm?: number | null;
  key?: string | null;
  time_signature?: string | null;
  chords?: AiCifraChordSegment[];
  segments?: AiCifraStructureSegment[];
  artifacts?: AiCifraAnalysisArtifacts | null;
};

export class AiCifraAnalysisResult extends ValueObject {
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  chords: AiCifraChordSegment[];
  segments: AiCifraStructureSegment[];
  artifacts: AiCifraAnalysisArtifacts | null;

  constructor(props: AiCifraAnalysisResultConstructorProps) {
    super();
    this.bpm = typeof props.bpm === "number" ? props.bpm : null;
    this.key = props.key ?? null;
    this.time_signature = props.time_signature ?? null;
    this.chords = props.chords ?? [];
    this.segments = props.segments ?? [];
    this.artifacts = props.artifacts ?? null;
  }

  toJSON() {
    return {
      bpm: this.bpm,
      key: this.key,
      time_signature: this.time_signature,
      chords: this.chords,
      segments: this.segments,
      artifacts: this.artifacts,
    };
  }
}

export type AiCifraAnalysisJobConstructorProps = {
  ai_cifra_analysis_job_id?: AiCifraAnalysisJobId;
  ai_cifra_upload_id: string;
  musician_id: string;
  model_id: string;
  status: AiCifraAnalysisJobStatus;
  progress_percent?: number;
  progress_stage?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: Date | null;
  finished_at?: Date | null;
  result?: AiCifraAnalysisResult | null;
  created_at?: Date;
  updated_at?: Date;
};

export type AiCifraAnalysisJobCreateCommand = {
  ai_cifra_analysis_job_id?: AiCifraAnalysisJobId;
  ai_cifra_upload_id: string;
  musician_id: string;
  model_id: string;
  status?: AiCifraAnalysisJobStatus;
};

export class AiCifraAnalysisJobId extends Uuid {}

export class AiCifraAnalysisJob extends AggregateRoot {
  ai_cifra_analysis_job_id: AiCifraAnalysisJobId;
  ai_cifra_upload_id: Uuid;
  musician_id: Uuid;
  model_id: string;
  status: AiCifraAnalysisJobStatus;
  progress_percent: number;
  progress_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  result: AiCifraAnalysisResult | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: AiCifraAnalysisJobConstructorProps) {
    super();
    this.ai_cifra_analysis_job_id =
      props.ai_cifra_analysis_job_id ?? new AiCifraAnalysisJobId();
    this.ai_cifra_upload_id = new Uuid(props.ai_cifra_upload_id);
    this.musician_id = new Uuid(props.musician_id);
    this.model_id = props.model_id;
    this.status = props.status;
    this.progress_percent = props.progress_percent ?? 0;
    this.progress_stage = props.progress_stage ?? null;
    this.error_code = props.error_code ?? null;
    this.error_message = props.error_message ?? null;
    this.started_at = props.started_at ?? null;
    this.finished_at = props.finished_at ?? null;
    this.result = props.result ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): AiCifraAnalysisJobId {
    return this.ai_cifra_analysis_job_id;
  }

  static create(props: AiCifraAnalysisJobCreateCommand): AiCifraAnalysisJob {
    const job = new AiCifraAnalysisJob({
      ...props,
      status: props.status ?? "queued",
    });
    job.validate(["ai_cifra_upload_id", "musician_id", "model_id", "status"]);
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
    this.updated_at = new Date();
    this.validate(["progress_percent", "progress_stage"]);
  }

  complete(result: AiCifraAnalysisResult): void {
    this.status = "completed";
    this.progress_percent = 100;
    this.progress_stage = "completed";
    this.finished_at = new Date();
    this.updated_at = new Date();
    this.result = result;
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
    this.progress_percent = 0;
    this.progress_stage = null;
    this.result = null;
    this.updated_at = new Date();
    this.validate(["status", "error_code", "error_message", "started_at"]);
  }

  validate(fields?: string[]): void {
    const validator = AiCifraAnalysisJobValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  toJSON() {
    return {
      id: this.ai_cifra_analysis_job_id.id,
      ai_cifra_upload_id: this.ai_cifra_upload_id.id,
      musician_id: this.musician_id.id,
      model_id: this.model_id,
      status: this.status,
      progress_percent: this.progress_percent,
      progress_stage: this.progress_stage,
      error_code: this.error_code,
      error_message: this.error_message,
      started_at: this.started_at,
      finished_at: this.finished_at,
      result: this.result ? this.result.toJSON() : null,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake(): typeof AiCifraAnalysisJobFakeBuilder {
    return AiCifraAnalysisJobFakeBuilder;
  }
}
