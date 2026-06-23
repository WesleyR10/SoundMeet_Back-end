import { AggregateRoot, Uuid } from "../../shared/domain";
import { AiAudioUploadValidatorFactory } from "./ai-audio-upload.validator";
import { AiAudioUploadFakeBuilder } from "./ai-audio-upload-fake.builder";

export type AiAudioUploadStatus =
  | "uploaded"
  | "rejected"
  | "separation_queued"
  | "separating"
  | "separated"
  | "separation_failed";

export type AiAudioUploadConstructorProps = {
  ai_audio_upload_id?: AiAudioUploadId;
  musician_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: "direct" | "presigned" | "multipart";
  multipart_upload_id?: string | null;
  duration_seconds?: number | null;
  codec?: string | null;
  sample_rate?: number | null;
  channels?: number | null;
  status: AiAudioUploadStatus;
  rejected_reason?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type AiAudioUploadCreateCommand = {
  ai_audio_upload_id?: AiAudioUploadId;
  musician_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: "direct" | "presigned" | "multipart";
  multipart_upload_id?: string | null;
  status?: AiAudioUploadStatus;
};

export class AiAudioUploadId extends Uuid {}

export class AiAudioUpload extends AggregateRoot {
  ai_audio_upload_id: AiAudioUploadId;
  musician_id: Uuid;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: "direct" | "presigned" | "multipart";
  multipart_upload_id: string | null;
  duration_seconds: number | null;
  codec: string | null;
  sample_rate: number | null;
  channels: number | null;
  status: AiAudioUploadStatus;
  rejected_reason: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: AiAudioUploadConstructorProps) {
    super();
    this.ai_audio_upload_id = props.ai_audio_upload_id ?? new AiAudioUploadId();
    this.musician_id = new Uuid(props.musician_id);
    this.original_filename = props.original_filename;
    this.content_type = props.content_type;
    this.file_size = props.file_size;
    this.object_key = props.object_key;
    this.upload_method = props.upload_method;
    this.multipart_upload_id = props.multipart_upload_id ?? null;
    this.duration_seconds = props.duration_seconds ?? null;
    this.codec = props.codec ?? null;
    this.sample_rate = props.sample_rate ?? null;
    this.channels = props.channels ?? null;
    this.status = props.status;
    this.rejected_reason = props.rejected_reason ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): AiAudioUploadId {
    return this.ai_audio_upload_id;
  }

  static create(props: AiAudioUploadCreateCommand): AiAudioUpload {
    const upload = new AiAudioUpload({
      ...props,
      status: props.status ?? "uploaded",
    });
    upload.validate([
      "musician_id",
      "original_filename",
      "content_type",
      "file_size",
      "object_key",
      "upload_method",
      "status",
    ]);
    return upload;
  }

  markRejected(reason: string): void {
    this.status = "rejected";
    this.rejected_reason = reason;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  markSeparationQueued(): void {
    this.status = "separation_queued";
    this.rejected_reason = null;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  markSeparating(): void {
    this.status = "separating";
    this.rejected_reason = null;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  markSeparated(): void {
    this.status = "separated";
    this.rejected_reason = null;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  markSeparationFailed(reason: string): void {
    this.status = "separation_failed";
    this.rejected_reason = reason;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  validate(fields?: string[]): void {
    const validator = AiAudioUploadValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  toJSON() {
    return {
      id: this.ai_audio_upload_id.id,
      musician_id: this.musician_id.id,
      original_filename: this.original_filename,
      content_type: this.content_type,
      file_size: this.file_size,
      object_key: this.object_key,
      upload_method: this.upload_method,
      multipart_upload_id: this.multipart_upload_id,
      duration_seconds: this.duration_seconds,
      codec: this.codec,
      sample_rate: this.sample_rate,
      channels: this.channels,
      status: this.status,
      rejected_reason: this.rejected_reason,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake(): typeof AiAudioUploadFakeBuilder {
    return AiAudioUploadFakeBuilder;
  }
}
