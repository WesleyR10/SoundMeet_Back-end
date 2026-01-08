import { Prisma } from "@prisma/client";

import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserBadge, UserBadgeId } from "../../../domain/user-badge.aggregate";
import { BadgeTypeEnum } from "../../../domain/value-objects/badge-type.vo";

// Tipo que reflete o schema Prisma real
export type UserBadgePrismaModel = {
  id: string;
  audienceId: string;
  badgeId: string;
  earnedAt: Date;
  progress: Prisma.JsonValue;
};

// Tipo para uso interno (compatível com a entidade)
export type UserBadgeModelProps = {
  id: string;
  user_id: string;
  badge_type: string;
  progress: number;
  is_unlocked: boolean;
  unlocked_at?: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class UserBadgeModelMapper {
  static toModel(entity: UserBadge): UserBadgeModelProps {
    return {
      id: entity.user_badge_id.id,
      user_id: entity.user_id.id, // Convertendo Uuid para string
      badge_type: entity.badge_type.value, // Convertendo BadgeType para string
      progress: entity.progress,
      is_unlocked: entity.is_unlocked,
      unlocked_at: entity.unlocked_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: UserBadgePrismaModel): UserBadge {
    // Convertendo do formato Prisma para a entidade
    const progressValue =
      typeof model.progress === "number" ? model.progress : 0;

    return new UserBadge({
      user_badge_id: new UserBadgeId(model.id),
      user_id: new Uuid(model.audienceId),
      badge_type: model.badgeId as BadgeTypeEnum,
      progress: progressValue,
      is_unlocked: progressValue >= 100, // Lógica de negócio: unlocked se progress >= 100
      unlocked_at: progressValue >= 100 ? model.earnedAt : null,
      created_at: model.earnedAt,
      updated_at: model.earnedAt,
    });
  }
}
