import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { INDICATION_STATUSES } from "./indication-types";

export class IndicationRules {
  @IsNotEmpty({ groups: ["audience_id"] })
  @IsString({ groups: ["audience_id"] })
  audience_id: string;

  @IsNotEmpty({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id: string;

  @IsNotEmpty({ groups: ["establishment_id"] })
  @IsString({ groups: ["establishment_id"] })
  establishment_id: string;

  @MaxLength(1000, { groups: ["message"] })
  @IsOptional({ groups: ["message"] })
  @IsString({ groups: ["message"] })
  message?: string | null;

  @IsIn(INDICATION_STATUSES as unknown as string[], { groups: ["status"] })
  status: string;

  constructor(data: any) {
    Object.assign(this, {
      audience_id: data.audience_id,
      musician_id: data.musician_id,
      establishment_id: data.establishment_id,
      message: data.message,
      status: data.status,
    });
  }
}

export class IndicationValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["audience_id", "musician_id", "establishment_id", "message", "status"];
    return super.validate(notification, new IndicationRules(data), newFields);
  }
}

export class IndicationValidatorFactory {
  static create() {
    return new IndicationValidator();
  }
}
