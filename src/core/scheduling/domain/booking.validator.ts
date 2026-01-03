import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Booking } from "./booking.aggregate";

export class BookingRules {
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

  @IsDate({ groups: ["start_at"] })
  start_at: Date;

  @IsDate({ groups: ["end_at"] })
  end_at: Date;

  @IsOptional({ groups: ["notes"] })
  @IsString({ groups: ["notes"] })
  notes?: string | null;

  @IsOptional({ groups: ["buffer_minutes"] })
  @IsInt({ groups: ["buffer_minutes"] })
  @Min(0, { groups: ["buffer_minutes"] })
  buffer_minutes?: number;

  @IsOptional({ groups: ["expires_at"] })
  @IsDate({ groups: ["expires_at"] })
  expires_at?: Date | null;

  constructor(entity: Booking | any) {
    this.establishment_id =
      entity?.establishment_id?.id || entity?.establishment_id;
    this.musician_id = entity?.musician_id?.id || entity?.musician_id || null;
    this.band_id = entity?.band_id?.id || entity?.band_id || null;
    this.event_id = entity?.event_id?.id || entity?.event_id || null;
    this.start_at = entity?.start_at;
    this.end_at = entity?.end_at;
    this.notes = entity?.notes;
    this.buffer_minutes = entity?.buffer_minutes;
    this.expires_at = entity?.expires_at;
  }
}

export class BookingValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["establishment_id", "start_at", "end_at"];
    return super.validate(notification, new BookingRules(data), newFields);
  }
}

export class BookingValidatorFactory {
  static create(): BookingValidator {
    return new BookingValidator();
  }
}
