import { IsIn, IsNotEmpty, IsUUID } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { GoogleCalendarSyncedEvent } from "./google-calendar-synced-event.aggregate";

export class GoogleCalendarSyncedEventRules {
  @IsNotEmpty({ groups: ["booking_id"] })
  @IsUUID(undefined, { groups: ["booking_id"] })
  booking_id: string;

  @IsNotEmpty({ groups: ["musician_id"] })
  @IsUUID(undefined, { groups: ["musician_id"] })
  musician_id: string;

  @IsIn(["pending", "synced", "failed", "deleted"], { groups: ["status"] })
  status: string;

  constructor(data: GoogleCalendarSyncedEvent) {
    this.booking_id = data.booking_id.id;
    this.musician_id = data.musician_id.id;
    this.status = data.status;
  }
}

export class GoogleCalendarSyncedEventValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["booking_id", "musician_id", "status"];
    return super.validate(
      notification,
      new GoogleCalendarSyncedEventRules(data),
      newFields,
    );
  }
}

export class GoogleCalendarSyncedEventValidatorFactory {
  static create(): GoogleCalendarSyncedEventValidator {
    return new GoogleCalendarSyncedEventValidator();
  }
}
