import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import {
  AiAudioUpload,
  AiAudioUploadStatus,
} from "./ai-audio-upload.aggregate";

export class AiAudioUploadRules {
  @IsUUID("4", { groups: ["musician_id"] })
  @IsNotEmpty({ groups: ["musician_id"] })
  musician_id: string;

  @MaxLength(1024, { groups: ["original_filename"] })
  @IsString({ groups: ["original_filename"] })
  @IsNotEmpty({ groups: ["original_filename"] })
  original_filename: string;

  @MaxLength(255, { groups: ["content_type"] })
  @IsString({ groups: ["content_type"] })
  @IsNotEmpty({ groups: ["content_type"] })
  content_type: string;

  @Min(1, { groups: ["file_size"] })
  @IsNumber({}, { groups: ["file_size"] })
  file_size: number;

  @MaxLength(2048, { groups: ["object_key"] })
  @IsString({ groups: ["object_key"] })
  @IsNotEmpty({ groups: ["object_key"] })
  object_key: string;

  @IsIn(["direct", "presigned", "multipart"], { groups: ["upload_method"] })
  @IsString({ groups: ["upload_method"] })
  @IsNotEmpty({ groups: ["upload_method"] })
  upload_method: string;

  @MaxLength(2048, { groups: ["multipart_upload_id"] })
  @IsOptional({ groups: ["multipart_upload_id"] })
  @IsString({ groups: ["multipart_upload_id"] })
  multipart_upload_id?: string;

  @IsIn(
    [
      "uploaded",
      "rejected",
      "separation_queued",
      "separating",
      "separated",
      "separation_failed",
    ],
    { groups: ["status"] },
  )
  @IsString({ groups: ["status"] })
  @IsNotEmpty({ groups: ["status"] })
  status: AiAudioUploadStatus;

  @MaxLength(2048, { groups: ["rejected_reason"] })
  @IsOptional({ groups: ["rejected_reason"] })
  @IsString({ groups: ["rejected_reason"] })
  rejected_reason?: string;

  constructor(entity: AiAudioUpload | any) {
    this.musician_id = entity?.musician_id?.id ?? entity?.musician_id;
    this.original_filename = entity?.original_filename;
    this.content_type = entity?.content_type;
    this.file_size = entity?.file_size;
    this.object_key = entity?.object_key;
    this.upload_method = entity?.upload_method;
    this.multipart_upload_id = entity?.multipart_upload_id ?? undefined;
    this.status = entity?.status;
    this.rejected_reason = entity?.rejected_reason ?? undefined;
  }
}

export class AiAudioUploadValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "musician_id",
          "original_filename",
          "content_type",
          "file_size",
          "object_key",
          "upload_method",
          "status",
        ];
    return super.validate(
      notification,
      new AiAudioUploadRules(data),
      newFields,
    );
  }
}

export class AiAudioUploadValidatorFactory {
  static create(): AiAudioUploadValidator {
    return new AiAudioUploadValidator();
  }
}
