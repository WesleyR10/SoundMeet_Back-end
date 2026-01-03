import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { UserScore } from "./user-score.aggregate";

export class UserScoreRules {
  @IsNotEmpty({ groups: ["user_id"] })
  @IsString({ groups: ["user_id"] })
  user_id: string;

  @IsNotEmpty({ groups: ["score_type"] })
  @IsString({ groups: ["score_type"] })
  score_type: string;

  @Min(0, { groups: ["points"] })
  @IsNotEmpty({ groups: ["points"] })
  @IsNumber({}, { groups: ["points"] })
  points: number;

  @MaxLength(255, { groups: ["reference_id"] })
  @IsOptional({ groups: ["reference_id"] })
  @IsString({ groups: ["reference_id"] })
  reference_id?: string;

  @MaxLength(500, { groups: ["description"] })
  @IsOptional({ groups: ["description"] })
  @IsString({ groups: ["description"] })
  description?: string;

  constructor(entity: UserScore | any) {
    this.user_id = entity?.user_id?.id ?? entity?.user_id;
    this.score_type = entity?.score_type;
    this.points = entity?.points;
    this.reference_id = entity?.reference_id;
    this.description = entity?.description;
  }
}

export class UserScoreValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["user_id", "score_type", "points"];
    return super.validate(notification, new UserScoreRules(data), newFields);
  }
}

export class UserScoreValidatorFactory {
  static create(): UserScoreValidator {
    return new UserScoreValidator();
  }
}
