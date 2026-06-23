import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { EventAttendee } from "./event-attendee.aggregate";

export class EventAttendeeRules {
  @IsNotEmpty({ groups: ["event_id"] })
  @IsString({ groups: ["event_id"] })
  event_id: string;

  @IsNotEmpty({ groups: ["audience_id"] })
  @IsString({ groups: ["audience_id"] })
  audience_id: string;

  @IsDate({ groups: ["joined_at"] })
  @IsOptional({ groups: ["joined_at"] })
  joined_at?: Date;

  @IsDate({ groups: ["left_at"] })
  @IsOptional({ groups: ["left_at"] })
  left_at?: Date | null;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active?: boolean;

  constructor(entity: EventAttendee | any) {
    Object.assign(this, {
      event_id: entity.event_id?.id ?? entity.event_id,
      audience_id: entity.audience_id?.id ?? entity.audience_id,
      joined_at: entity.joined_at,
      left_at: entity.left_at,
      is_active: entity.is_active,
    });
  }
}

export class EventAttendeeValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["event_id", "audience_id", "joined_at", "left_at", "is_active"];
    return super.validate(
      notification,
      new EventAttendeeRules(data),
      newFields,
    );
  }
}

export class EventAttendeeValidatorFactory {
  static create(): EventAttendeeValidator {
    return new EventAttendeeValidator();
  }
}
