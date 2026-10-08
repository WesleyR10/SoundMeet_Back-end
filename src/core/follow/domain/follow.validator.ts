import { IsBoolean, IsIn, IsNotEmpty, IsString } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { FOLLOW_TARGET_TYPES } from "./follow-types";

export class FollowRules {
  @IsNotEmpty({ groups: ["audience_id"] })
  @IsString({ groups: ["audience_id"] })
  audience_id: string;

  @IsIn(FOLLOW_TARGET_TYPES as unknown as string[], { groups: ["target_type"] })
  target_type: string;

  @IsNotEmpty({ groups: ["target_id"] })
  @IsString({ groups: ["target_id"] })
  target_id: string;

  @IsBoolean({ groups: ["notifications_enabled"] })
  notifications_enabled: boolean;

  constructor(data: any) {
    Object.assign(this, {
      audience_id: data.audience_id,
      target_type: data.target_type,
      target_id: data.target_id,
      notifications_enabled: data.notifications_enabled,
    });
  }
}

export class FollowValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["audience_id", "target_type", "target_id", "notifications_enabled"];
    return super.validate(notification, new FollowRules(data), newFields);
  }
}

export class FollowValidatorFactory {
  static create() {
    return new FollowValidator();
  }
}
