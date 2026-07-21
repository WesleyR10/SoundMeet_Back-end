import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { GoogleCalendarIntegration } from "./google-calendar-integration.aggregate";

export class GoogleCalendarIntegrationRules {
  @IsNotEmpty({ groups: ["musician_id"] })
  @IsUUID(undefined, { groups: ["musician_id"] })
  musician_id: string;

  @IsNotEmpty({ groups: ["google_account_email"] })
  @IsEmail(undefined, { groups: ["google_account_email"] })
  google_account_email: string;

  @IsOptional({ groups: ["scope"] })
  @IsString({ groups: ["scope"] })
  scope: string | null;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active: boolean;

  constructor(data: GoogleCalendarIntegration) {
    this.musician_id = data.musician_id.id;
    this.google_account_email = data.google_account_email;
    this.scope = data.scope;
    this.is_active = data.is_active;
  }
}

export class GoogleCalendarIntegrationValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["musician_id", "google_account_email", "scope", "is_active"];
    return super.validate(
      notification,
      new GoogleCalendarIntegrationRules(data),
      newFields,
    );
  }
}

export class GoogleCalendarIntegrationValidatorFactory {
  static create(): GoogleCalendarIntegrationValidator {
    return new GoogleCalendarIntegrationValidator();
  }
}
