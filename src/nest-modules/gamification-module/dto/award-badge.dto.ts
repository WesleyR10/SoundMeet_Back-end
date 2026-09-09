import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { AwardBadgeInput } from "../../../core/gamification/application/use-cases/award-badge/award-badge.input";
import {
  BadgeType,
  BadgeTypeEnum,
} from "../../../core/gamification/domain/value-objects/badge-type.vo";

export class AwardBadgeDto extends AwardBadgeInput {
  @ApiProperty({ format: "uuid" })
  declare user_id: string;

  @ApiProperty({ enum: BadgeTypeEnum })
  declare badge_type: BadgeType;

  @ApiPropertyOptional()
  declare points_earned?: number;

  @ApiPropertyOptional()
  declare metadata?: Record<string, any>;
}
