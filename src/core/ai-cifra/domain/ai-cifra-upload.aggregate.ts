import { AggregateRoot, Uuid } from "../../shared/domain";
import { AiCifraUploadValidatorFactory } from "./ai-cifra-upload.validator";
import { AiCifraUploadFakeBuilder } from "./ai-cifra-upload-fake.builder";

export type AiCifraUploadStatus =
  | "uploaded"
  | "rejected"
  | "analysis_queued"
  | "analyzing"
  | "analyzed"
  | "analysis_failed";

export type AiCifraUploadConstructorProps = {
  ai_cifra_upload_id?: AiCifraUploadId;
  musician_id: string;
  music_library_id?: string | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: "direct" | "presigned" | "multipart";
  status: AiCifraUploadStatus;
  rejected_reason?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type AiCifraUploadCreateCommand = {
  ai_cifra_upload_id?: AiCifraUploadId;
  musician_id: string;
  music_library_id?: string | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: "direct" | "presigned" | "multipart";
  status?: AiCifraUploadStatus;
};

export class AiCifraUploadId extends Uuid {}

export class AiCifraUpload extends AggregateRoot {
  ai_cifra_upload_id: AiCifraUploadId;
  musician_id: Uuid;
  music_library_id: Uuid | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  object_key: string;
  upload_method: "direct" | "presigned" | "multipart";
  status: AiCifraUploadStatus;
  rejected_reason: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: AiCifraUploadConstructorProps) {
    super();
    this.ai_cifra_upload_id = props.ai_cifra_upload_id ?? new AiCifraUploadId();
    this.musician_id = new Uuid(props.musician_id);
    this.music_library_id = props.music_library_id
      ? new Uuid(props.music_library_id)
      : null;
    this.original_filename = props.original_filename;
    this.content_type = props.content_type;
    this.file_size = props.file_size;
    this.object_key = props.object_key;
    this.upload_method = props.upload_method;
    this.status = props.status;
    this.rejected_reason = props.rejected_reason ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): AiCifraUploadId {
    return this.ai_cifra_upload_id;
  }

  static create(props: AiCifraUploadCreateCommand): AiCifraUpload {
    const upload = new AiCifraUpload({
      ...props,
      status: props.status ?? "uploaded",
    });

    upload.validate([
      "musician_id",
      "music_library_id",
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

  markAnalysisQueued(): void {
    this.status = "analysis_queued";
    this.rejected_reason = null;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  markAnalyzing(): void {
    this.status = "analyzing";
    this.rejected_reason = null;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  markAnalyzed(): void {
    this.status = "analyzed";
    this.rejected_reason = null;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  markAnalysisFailed(reason: string): void {
    this.status = "analysis_failed";
    this.rejected_reason = reason;
    this.updated_at = new Date();
    this.validate(["status", "rejected_reason"]);
  }

  validate(fields?: string[]): void {
    const validator = AiCifraUploadValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  toJSON() {
    return {
      id: this.ai_cifra_upload_id.id,
      musician_id: this.musician_id.id,
      music_library_id: this.music_library_id?.id ?? null,
      original_filename: this.original_filename,
      content_type: this.content_type,
      file_size: this.file_size,
      object_key: this.object_key,
      upload_method: this.upload_method,
      status: this.status,
      rejected_reason: this.rejected_reason,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake(): typeof AiCifraUploadFakeBuilder {
    return AiCifraUploadFakeBuilder;
  }
}
