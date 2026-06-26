import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";

const CAMPAIGN_STATUSES = ["draft", "active", "sent", "cancelled"] as const;

export class CampaignRules {
  @MaxLength(255, { groups: ["title"] })
  @IsNotEmpty({ groups: ["title"] })
  @IsString({ groups: ["title"] })
  title: string;

  @IsNotEmpty({ groups: ["establishment_id"] })
  @IsString({ groups: ["establishment_id"] })
  establishment_id: string;

  @MaxLength(2000, { groups: ["description"] })
  @IsOptional({ groups: ["description"] })
  @IsString({ groups: ["description"] })
  description?: string | null;

  @IsIn(CAMPAIGN_STATUSES, { groups: ["status"] })
  @IsOptional({ groups: ["status"] })
  status?: string;

  constructor(data: any) {
    Object.assign(this, {
      title: data.title,
      establishment_id: data.establishment_id,
      description: data.description,
      status: data.status,
    });
  }
}

export class CampaignValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : ["title", "establishment_id"];
    return super.validate(notification, new CampaignRules(data), newFields);
  }
}

export class CampaignValidatorFactory {
  static create(): CampaignValidator {
    return new CampaignValidator();
  }
}
