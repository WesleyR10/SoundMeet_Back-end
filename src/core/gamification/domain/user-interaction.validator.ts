import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";

export class UserInteractionRules {
  @IsNotEmpty({ groups: ["user_id"] })
  @IsString({ groups: ["user_id"] })
  user_id: string;

  @IsNotEmpty({ groups: ["interaction_type"] })
  @IsString({ groups: ["interaction_type"] })
  interaction_type: string;

  @IsString({ groups: ["target_id"] })
  @IsOptional({ groups: ["target_id"] })
  target_id?: string | null;

  @IsObject({ groups: ["metadata"] })
  @IsOptional({ groups: ["metadata"] })
  metadata?: Record<string, any> | null;

  @Min(0, { groups: ["points_earned"] })
  @IsNumber({}, { groups: ["points_earned"] })
  @IsOptional({ groups: ["points_earned"] })
  points_earned?: number;

  constructor(entity: any) {
    this.user_id = entity?.user_id?.id ?? entity?.user_id;
    this.interaction_type = entity?.interaction_type;
    this.target_id = entity?.target_id;
    this.metadata = entity?.metadata;
    this.points_earned = entity?.points_earned;

    if (
      entity?.user_id &&
      typeof entity.user_id === "object" &&
      entity.user_id.id
    ) {
      this.user_id = entity.user_id.id;
    }
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
