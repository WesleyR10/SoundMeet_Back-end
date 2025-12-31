import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { UserBadge } from "./user-badge.aggregate";
import { BadgeTypeEnum } from "./value-objects/badge-type.vo";

export class UserBadgeRules {
  @IsNotEmpty({ groups: ["user_id"] })
  @IsString({ groups: ["user_id"] })
  @IsUUID(4, { groups: ["user_id"] })
  user_id: string;

  @IsNotEmpty({ groups: ["badge_type"] })
  @IsString({ groups: ["badge_type"] })
  @IsIn(Object.values(BadgeTypeEnum), { groups: ["badge_type"] })
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
    this.user_id = entity?.user_id?.id ?? entity?.user_id;
    this.badge_type = entity?.badge_type?.value ?? entity?.badge_type;
    this.progress = entity?.progress;
    this.is_unlocked = entity?.is_unlocked;
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
