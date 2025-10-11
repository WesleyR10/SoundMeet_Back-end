import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  validateSync,
} from "class-validator";
import { BadgeType } from "@core/gamification/domain/value-objects/badge-type.vo";

export type AwardBadgeInputConstructorProps = {
  user_id: string;
  badge_type: BadgeType;
  points_earned?: number;
  metadata?: Record<string, any>;
};

export class AwardBadgeInput {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsEnum(BadgeType)
  @IsNotEmpty()
  badge_type: BadgeType;

  @IsNumber()
  @IsOptional()
  points_earned?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  constructor(props: AwardBadgeInputConstructorProps) {
    if (!props) return;
    this.user_id = props.user_id;
    this.badge_type = props.badge_type;
    this.points_earned = props.points_earned;
    this.metadata = props.metadata;
  }
}

export class ValidateAwardBadgeInput {
  static validate(input: AwardBadgeInput) {
    return validateSync(input);
  }
}
