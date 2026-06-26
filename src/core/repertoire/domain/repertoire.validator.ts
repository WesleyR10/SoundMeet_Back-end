import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";

export class RepertoireRules {
  @MaxLength(255, { groups: ["name"] })
  @IsNotEmpty({ groups: ["name"] })
  @IsString({ groups: ["name"] })
  name: string;

  @IsNotEmpty({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id: string;

  constructor(data: any) {
    Object.assign(this, { name: data.name, musician_id: data.musician_id });
  }
}

export class RepertoireValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : ["name", "musician_id"];
    return super.validate(notification, new RepertoireRules(data), newFields);
  }
}

export class RepertoireValidatorFactory {
  static create(): RepertoireValidator {
    return new RepertoireValidator();
  }
}
