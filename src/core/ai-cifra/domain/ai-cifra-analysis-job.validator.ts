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
  AiCifraAnalysisJob,
  AiCifraAnalysisJobStatus,
} from "./ai-cifra-analysis-job.aggregate";

export class AiCifraAnalysisJobRules {
  @IsUUID("4", { groups: ["ai_cifra_upload_id"] })
  @IsNotEmpty({ groups: ["ai_cifra_upload_id"] })
  ai_cifra_upload_id: string;

  @IsUUID("4", { groups: ["musician_id"] })
  @IsNotEmpty({ groups: ["musician_id"] })
  musician_id: string;

  @MaxLength(255, { groups: ["model_id"] })
  @IsString({ groups: ["model_id"] })
  @IsNotEmpty({ groups: ["model_id"] })
  model_id: string;

  @IsIn(["queued", "processing", "completed", "failed"], { groups: ["status"] })
  @IsString({ groups: ["status"] })
  @IsNotEmpty({ groups: ["status"] })
  status: AiCifraAnalysisJobStatus;

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

  constructor(entity: AiCifraAnalysisJob | any) {
    this.ai_cifra_upload_id =
      entity?.ai_cifra_upload_id?.id ?? entity?.ai_cifra_upload_id;
    this.musician_id = entity?.musician_id?.id ?? entity?.musician_id;
    this.model_id = entity?.model_id;
    this.status = entity?.status;
    this.progress_percent = entity?.progress_percent;
    this.progress_stage = entity?.progress_stage ?? undefined;
    this.error_code = entity?.error_code ?? undefined;
    this.error_message = entity?.error_message ?? undefined;
    this.started_at = entity?.started_at ?? undefined;
    this.finished_at = entity?.finished_at ?? undefined;
  }
}

export class AiCifraAnalysisJobValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "ai_cifra_upload_id",
          "musician_id",
          "model_id",
          "status",
          "progress_percent",
        ];

    return super.validate(
      notification,
      new AiCifraAnalysisJobRules(data),
      newFields,
    );
  }
}

export class AiCifraAnalysisJobValidatorFactory {
  static create(): AiCifraAnalysisJobValidator {
    return new AiCifraAnalysisJobValidator();
  }
}
