import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  BadgeCategory,
  BadgeRarity,
} from "../../../core/gamification/domain/badge.aggregate";
import { CreateBadgeInput } from "../../../core/gamification/application/use-cases/create-badge/create-badge.input";

export class CreateBadgeDto extends CreateBadgeInput {
  @ApiProperty({ example: "Primeira Gorjeta" })
  declare name: string;

  @ApiProperty({ example: "Enviou a primeira gorjeta para um músico." })
  declare description: string;

  @ApiProperty({ example: "tip_bronze" })
  declare icon: string;

  @ApiProperty({ enum: ["engagement", "support", "discovery", "social"] })
  declare category: BadgeCategory;

  @ApiProperty({ example: { action: "send_tip", count: 1 } })
  declare requirement: Record<string, any>;

  @ApiPropertyOptional({ example: 50 })
  declare points?: number;

  @ApiPropertyOptional({ enum: ["common", "rare", "epic", "legendary"] })
  declare rarity?: BadgeRarity;

  @ApiPropertyOptional({ default: true })
  declare is_active?: boolean;
}
