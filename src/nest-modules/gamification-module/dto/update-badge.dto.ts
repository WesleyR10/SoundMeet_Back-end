import { ApiPropertyOptional } from "@nestjs/swagger";

import { UpdateBadgeInput } from "../../../core/gamification/application/use-cases/update-badge/update-badge.input";
import {
  BadgeCategory,
  BadgeRarity,
} from "../../../core/gamification/domain/badge.aggregate";

export class UpdateBadgeDto extends UpdateBadgeInput {
  @ApiPropertyOptional()
  declare name?: string;

  @ApiPropertyOptional()
  declare description?: string;

  @ApiPropertyOptional()
  declare icon?: string;

  @ApiPropertyOptional({
    enum: ["engagement", "support", "discovery", "social"],
  })
  declare category?: BadgeCategory;

  @ApiPropertyOptional()
  declare requirement?: Record<string, any>;

  @ApiPropertyOptional()
  declare points?: number;

  @ApiPropertyOptional({ enum: ["common", "rare", "epic", "legendary"] })
  declare rarity?: BadgeRarity;

  @ApiPropertyOptional()
  declare is_active?: boolean;
}
