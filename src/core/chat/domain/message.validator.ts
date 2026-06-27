import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Message } from "./message.aggregate";

export class MessageRules {
  @IsUUID("4", { groups: ["conversation_id"] })
  @IsNotEmpty({ groups: ["conversation_id"] })
  conversation_id: string;

  @IsNotEmpty({ groups: ["sender_id"] })
  sender_id: string;

  @IsIn(["musician", "establishment", "band"], { groups: ["sender_type"] })
  sender_type: string;

  @IsString({ groups: ["content"] })
  @MinLength(1, { groups: ["content"] })
  @MaxLength(2000, { groups: ["content"] })
  content: string;

  constructor(entity: Message | any) {
    this.conversation_id = entity?.conversation_id;
    this.sender_id = entity?.sender_id;
    this.sender_type = entity?.sender_type;
    this.content = entity?.content;
  }
}

export class MessageValidator extends ClassValidatorFields {
  validate(
    notification: Notification,
    data: any,
    fields?: string[],
  ): boolean {
    const newFields = fields?.length
      ? fields
      : ["conversation_id", "sender_id", "sender_type", "content"];
    return super.validate(notification, new MessageRules(data), newFields);
  }
}

export class MessageValidatorFactory {
  static create(): MessageValidator {
    return new MessageValidator();
  }
}
