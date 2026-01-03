import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Availability } from "./availability.aggregate";

export class AvailabilityRules {
  @MaxLength(36, { groups: ["musician_id"] })
  @IsOptional({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id: string | null;

  @MaxLength(36, { groups: ["band_id"] })
  @IsOptional({ groups: ["band_id"] })
  @IsString({ groups: ["band_id"] })
  band_id: string | null;

  @IsOptional({ groups: ["is_active"] })
  @IsBoolean({ groups: ["is_active"] })
  is_active: boolean;

  @IsString({ groups: ["timezone"] })
  timezone: string;

  @IsInt({ groups: ["default_buffer_minutes"] })
  @Min(0, { groups: ["default_buffer_minutes"] })
  default_buffer_minutes: number;

  @IsOptional({ groups: ["max_shows_per_day"] })
  @IsInt({ groups: ["max_shows_per_day"] })
  @Min(1, { groups: ["max_shows_per_day"] })
  max_shows_per_day: number | null;

  constructor(entity: Availability | any) {
    this.musician_id = entity?.musician_id?.id ?? entity?.musician_id ?? null;
    this.band_id = entity?.band_id?.id ?? entity?.band_id ?? null;
    this.is_active = entity?.is_active;
    this.timezone = entity?.timezone;
    this.default_buffer_minutes = entity?.default_buffer_minutes;
    this.max_shows_per_day = entity?.max_shows_per_day ?? null;
  }
}

export class AvailabilityValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["musician_id", "band_id", "is_active"];
    if (!fields?.length) {
      newFields.push("timezone", "default_buffer_minutes", "max_shows_per_day");
    }
    return super.validate(notification, new AvailabilityRules(data), newFields);
  }
}

export class AvailabilityValidatorFactory {
  static create() {
    return new AvailabilityValidator();
  }
}
