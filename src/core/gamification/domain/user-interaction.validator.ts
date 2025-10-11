import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsObject,
} from "class-validator";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";

export class UserInteractionRules {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  interaction_type: string;

  @IsString()
  @IsOptional()
  target_id?: string | null;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any> | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points_earned?: number;

  constructor(data: any) {
    Object.assign(this, data);
  }
}

export class UserInteractionValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["user_id", "interaction_type", "points_earned"];
    return super.validate(
      notification,
      new UserInteractionRules(data),
      newFields,
    );
  }
}

export class UserInteractionValidatorFactory {
  static create(): UserInteractionValidator {
    return new UserInteractionValidator();
  }
}
