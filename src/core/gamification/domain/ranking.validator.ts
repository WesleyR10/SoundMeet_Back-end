import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Ranking } from "./ranking.aggregate";

export class RankingRules {
  @IsNotEmpty({ groups: ["user_id"] })
  @IsString({ groups: ["user_id"] })
  @IsUUID(4, { groups: ["user_id"] })
  user_id: string;

  @IsNotEmpty({ groups: ["ranking_type"] })
  @IsString({ groups: ["ranking_type"] })
  ranking_type: string;

  @IsNotEmpty({ groups: ["period"] })
  @IsString({ groups: ["period"] })
  period: string;

  @Min(1, { groups: ["position"] })
  @IsNotEmpty({ groups: ["position"] })
  @IsNumber({}, { groups: ["position"] })
  position: number;

  @Min(0, { groups: ["score"] })
  @IsNotEmpty({ groups: ["score"] })
  @IsNumber({}, { groups: ["score"] })
  score: number;

  @IsDate({ groups: ["period_start"] })
  @IsNotEmpty({ groups: ["period_start"] })
  period_start: Date;

  @IsDate({ groups: ["period_end"] })
  @IsNotEmpty({ groups: ["period_end"] })
  period_end: Date;

  constructor(entity: Ranking) {
    Object.assign(this, entity);
    if (entity.user_id instanceof Uuid) {
      this.user_id = entity.user_id.id;
    }
  }
}

export class RankingValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "user_id",
          "ranking_type",
          "period",
          "position",
          "score",
          "period_start",
          "period_end",
        ];
    return super.validate(notification, new RankingRules(data), newFields);
  }
}

export class RankingValidatorFactory {
  static create(): RankingValidator {
    return new RankingValidator();
  }
}
