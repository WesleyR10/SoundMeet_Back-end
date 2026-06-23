import { IsIn, IsNotEmpty, IsUUID } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { RequestVote } from "./request-vote.aggregate";
import { RequestVoteType } from "./value-objects/request-vote-type.vo";

export class RequestVoteRules {
  @IsUUID(4, { groups: ["request_id"] })
  @IsNotEmpty({ groups: ["request_id"] })
  request_id: string;

  @IsUUID(4, { groups: ["audience_id"] })
  @IsNotEmpty({ groups: ["audience_id"] })
  audience_id: string;

  @IsIn(Object.values(RequestVoteType), { groups: ["vote_type"] })
  @IsNotEmpty({ groups: ["vote_type"] })
  vote_type: string;

  constructor(entity: RequestVote | any) {
    this.request_id = entity.request_id?.id || entity.request_id;
    this.audience_id = entity.audience_id?.id || entity.audience_id;
    this.vote_type = entity.vote_type;
  }
}

export class RequestVoteValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["request_id", "audience_id", "vote_type"];
    return super.validate(notification, new RequestVoteRules(data), newFields);
  }
}

export class RequestVoteValidatorFactory {
  static create(): RequestVoteValidator {
    return new RequestVoteValidator();
  }
}
