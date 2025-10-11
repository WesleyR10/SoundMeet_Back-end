import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from "class-validator";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { UserBadge } from "./user-badge.aggregate";

export class UserBadgeRules {
  @IsNotEmpty({ groups: ["user_id"] })
  @IsString({ groups: ["user_id"] })
  user_id: string;

  @IsNotEmpty({ groups: ["badge_type"] })
  @IsString({ groups: ["badge_type"] })
  badge_type: string;

  @Min(0, { groups: ["progress"] })
  @Max(100, { groups: ["progress"] })
  @IsNotEmpty({ groups: ["progress"] })
  @IsNumber({}, { groups: ["progress"] })
  progress: number;

  @IsBoolean({ groups: ["is_unlocked"] })
  @IsOptional({ groups: ["is_unlocked"] })
  is_unlocked?: boolean;

  constructor(entity: UserBadge | any) {
    Object.assign(this, entity);
  }
}

export class UserBadgeValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["user_id", "badge_type", "progress"];
    return super.validate(notification, new UserBadgeRules(data), newFields);
  }
}

export class UserBadgeValidatorFactory {
  static create(): UserBadgeValidator {
    return new UserBadgeValidator();
  }
}
