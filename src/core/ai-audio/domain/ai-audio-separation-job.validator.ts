import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobStatus,
} from "./ai-audio-separation-job.aggregate";

export class AiAudioSeparationJobRules {
  @IsUUID("4", { groups: ["ai_audio_upload_id"] })
  @IsNotEmpty({ groups: ["ai_audio_upload_id"] })
  ai_audio_upload_id: string;

  @IsUUID("4", { groups: ["musician_id"] })
  @IsNotEmpty({ groups: ["musician_id"] })
  musician_id: string;

  @MaxLength(255, { groups: ["model_id"] })
  @IsString({ groups: ["model_id"] })
  @IsNotEmpty({ groups: ["model_id"] })
  model_id: string;

  @MaxLength(2048, { groups: ["output_prefix"] })
  @IsString({ groups: ["output_prefix"] })
  @IsNotEmpty({ groups: ["output_prefix"] })
  output_prefix: string;

  @IsIn(["wav", "flac", "mp3"], { groups: ["output_format"] })
  @IsOptional({ groups: ["output_format"] })
  @IsString({ groups: ["output_format"] })
  output_format?: "wav" | "flac" | "mp3";

  @IsIn(["queued", "processing", "completed", "failed"], { groups: ["status"] })
  @IsString({ groups: ["status"] })
  @IsNotEmpty({ groups: ["status"] })
  status: AiAudioSeparationJobStatus;

  @IsInt({ groups: ["progress_percent"] })
  @Min(0, { groups: ["progress_percent"] })
  @Max(100, { groups: ["progress_percent"] })
  progress_percent: number;

  @MaxLength(64, { groups: ["progress_stage"] })
  @IsOptional({ groups: ["progress_stage"] })
  @IsString({ groups: ["progress_stage"] })
  progress_stage?: string;

  @MaxLength(255, { groups: ["error_code"] })
  @IsOptional({ groups: ["error_code"] })
  @IsString({ groups: ["error_code"] })
  error_code?: string;

  @MaxLength(2048, { groups: ["error_message"] })
  @IsOptional({ groups: ["error_message"] })
  @IsString({ groups: ["error_message"] })
  error_message?: string;

  @IsDate({ groups: ["started_at"] })
  @IsOptional({ groups: ["started_at"] })
  started_at?: Date;

  @IsDate({ groups: ["finished_at"] })
  @IsOptional({ groups: ["finished_at"] })
  finished_at?: Date;

  constructor(entity: AiAudioSeparationJob | any) {
    this.ai_audio_upload_id =
      entity?.ai_audio_upload_id?.id ?? entity?.ai_audio_upload_id;
    this.musician_id = entity?.musician_id?.id ?? entity?.musician_id;
    this.model_id = entity?.model_id;
    this.output_prefix = entity?.output_prefix;
    this.output_format = entity?.output_format ?? undefined;
    this.status = entity?.status;
    this.progress_percent = entity?.progress_percent;
    this.progress_stage = entity?.progress_stage ?? undefined;
    this.error_code = entity?.error_code ?? undefined;
    this.error_message = entity?.error_message ?? undefined;
    this.started_at = entity?.started_at ?? undefined;
    this.finished_at = entity?.finished_at ?? undefined;
  }
}

export class AiAudioSeparationJobValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "ai_audio_upload_id",
          "musician_id",
          "model_id",
          "output_prefix",
          "status",
          "progress_percent",
        ];
    return super.validate(
      notification,
      new AiAudioSeparationJobRules(data),
      newFields,
    );
  }
}

export class AiAudioSeparationJobValidatorFactory {
  static create(): AiAudioSeparationJobValidator {
    return new AiAudioSeparationJobValidator();
  }
}
