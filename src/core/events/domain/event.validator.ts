import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Event } from "./event.aggregate";

export class EventRules {
  @IsNotEmpty({ groups: ["establishment_id"] })
  @IsString({ groups: ["establishment_id"] })
  establishment_id: string;

  @MaxLength(255, { groups: ["name"] })
  @IsNotEmpty({ groups: ["name"] })
  @IsString({ groups: ["name"] })
  name: string;

  @MaxLength(2000, { groups: ["description"] })
  @IsOptional({ groups: ["description"] })
  @IsString({ groups: ["description"] })
  description?: string;

  @IsDate({ groups: ["start_at"] })
  start_at: Date;

  @IsDate({ groups: ["end_at"] })
  end_at: Date;

  @IsIn(["scheduled", "active", "completed", "cancelled"], {
    groups: ["status"],
  })
  @IsOptional({ groups: ["status"] })
  status?: string;

  @IsInt({ groups: ["max_capacity"] })
  @Min(0, { groups: ["max_capacity"] })
  @IsOptional({ groups: ["max_capacity"] })
  max_capacity?: number;

  @IsInt({ groups: ["current_capacity"] })
  @Min(0, { groups: ["current_capacity"] })
  @IsOptional({ groups: ["current_capacity"] })
  current_capacity?: number;

  @IsBoolean({ groups: ["is_public"] })
  @IsOptional({ groups: ["is_public"] })
  is_public?: boolean;

  @IsNumber({}, { groups: ["cover_charge"] })
  @Min(0, { groups: ["cover_charge"] })
  @IsOptional({ groups: ["cover_charge"] })
  cover_charge?: number;

  constructor(entity: Event | any) {
    Object.assign(this, {
      establishment_id: entity.establishment_id?.id ?? entity.establishment_id,
      name: entity.name,
      description: entity.description,
      start_at: entity.start_at,
      end_at: entity.end_at,
      status: entity.status,
      max_capacity: entity.max_capacity,
      current_capacity: entity.current_capacity,
      is_public: entity.is_public,
      cover_charge: entity.cover_charge,
    });
  }
}

export class EventValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "establishment_id",
          "name",
          "description",
          "start_at",
          "end_at",
          "status",
          "max_capacity",
          "current_capacity",
          "is_public",
          "cover_charge",
        ];
    return super.validate(notification, new EventRules(data), newFields);
  }
}

export class EventValidatorFactory {
  static create(): EventValidator {
    return new EventValidator();
  }
}
