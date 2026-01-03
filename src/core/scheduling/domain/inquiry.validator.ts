import { IsDate, IsNotEmpty, IsOptional, IsString } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Inquiry } from "./inquiry.aggregate";

export class InquiryRules {
  @IsString({ groups: ["establishment_id"] })
  @IsNotEmpty({ groups: ["establishment_id"] })
  establishment_id: string;

  @IsOptional({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id?: string | null;

  @IsOptional({ groups: ["band_id"] })
  @IsString({ groups: ["band_id"] })
  band_id?: string | null;

  @IsOptional({ groups: ["event_id"] })
  @IsString({ groups: ["event_id"] })
  event_id?: string | null;

  @IsOptional({ groups: ["subject"] })
  @IsString({ groups: ["subject"] })
  subject?: string | null;

  @IsOptional({ groups: ["initial_message"] })
  @IsString({ groups: ["initial_message"] })
  initial_message?: string | null;

  @IsOptional({ groups: ["expires_at"] })
  @IsDate({ groups: ["expires_at"] })
  expires_at?: Date | null;

  constructor(entity: Inquiry | any) {
    this.establishment_id =
      entity?.establishment_id?.id || entity?.establishment_id;
    this.musician_id = entity?.musician_id?.id || entity?.musician_id || null;
    this.band_id = entity?.band_id?.id || entity?.band_id || null;
    this.event_id = entity?.event_id?.id || entity?.event_id || null;
    this.subject = entity?.subject;
    this.initial_message = entity?.initial_message;
    this.expires_at = entity?.expires_at;
  }
}

export class InquiryValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : ["establishment_id", "subject"];
    return super.validate(notification, new InquiryRules(data), newFields);
  }
}

export class InquiryValidatorFactory {
  static create(): InquiryValidator {
    return new InquiryValidator();
  }
}
