import {
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
import { RequestFeedback } from "./request-feedback.aggregate";

export class RequestFeedbackRules {
  @IsUUID(4, { groups: ["request_id"] })
  @IsNotEmpty({ groups: ["request_id"] })
  request_id: string;

  @Min(1, { groups: ["rating"] })
  @Max(5, { groups: ["rating"] })
  @IsInt({ groups: ["rating"] })
  @IsNotEmpty({ groups: ["rating"] })
  rating: number;

  @MaxLength(500, { groups: ["comment"] })
  @IsOptional({ groups: ["comment"] })
  @IsString({ groups: ["comment"] })
  comment?: string | null;

  constructor(entity: RequestFeedback | any) {
    this.request_id = entity.request_id?.id || entity.request_id;
    this.rating = entity.rating;
    this.comment = entity.comment ?? undefined;
  }
}

export class RequestFeedbackValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["request_id", "rating", "comment"];
    return super.validate(
      notification,
      new RequestFeedbackRules(data),
      newFields,
    );
  }
}

export class RequestFeedbackValidatorFactory {
  static create(): RequestFeedbackValidator {
    return new RequestFeedbackValidator();
  }
}
