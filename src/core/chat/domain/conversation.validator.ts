import { IsNotEmpty, IsOptional, IsUUID } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Conversation } from "./conversation.aggregate";

export class ConversationRules {
  @IsUUID("4", { groups: ["inquiry_id"] })
  @IsNotEmpty({ groups: ["inquiry_id"] })
  inquiry_id: string;

  @IsUUID("4", { groups: ["establishment_id"] })
  @IsNotEmpty({ groups: ["establishment_id"] })
  establishment_id: string;

  @IsOptional({ groups: ["musician_id"] })
  @IsUUID("4", { groups: ["musician_id"] })
  musician_id: string | null;

  @IsOptional({ groups: ["band_id"] })
  @IsUUID("4", { groups: ["band_id"] })
  band_id: string | null;

  constructor(entity: Conversation | any) {
    this.inquiry_id = entity?.inquiry_id;
    this.establishment_id = entity?.establishment_id;
    this.musician_id = entity?.musician_id;
    this.band_id = entity?.band_id;
  }
}

export class ConversationValidator extends ClassValidatorFields {
  validate(
    notification: Notification,
    data: any,
    fields?: string[],
  ): boolean {
    const newFields = fields?.length
      ? fields
      : ["inquiry_id", "establishment_id", "musician_id", "band_id"];
    return super.validate(notification, new ConversationRules(data), newFields);
  }
}

export class ConversationValidatorFactory {
  static create(): ConversationValidator {
    return new ConversationValidator();
  }
}
