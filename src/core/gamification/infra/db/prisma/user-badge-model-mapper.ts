import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserBadge, UserBadgeId } from "../../../domain/user-badge.aggregate";
import { BadgeTypeEnum } from "../../../domain/value-objects/badge-type.vo";

// Reflete o schema Prisma real da tabela user_badges (alinhado ao agregado).
export type UserBadgePrismaModel = {
  id: string;
  audienceId: string;
  badge_type: string;
  progress: number;
  is_unlocked: boolean;
  unlocked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

// Shape de escrita usado pelo repositório (nomes de coluna do Prisma).
export type UserBadgeModelProps = UserBadgePrismaModel;

export class UserBadgeModelMapper {
  static toModel(entity: UserBadge): UserBadgeModelProps {
    return {
      id: entity.user_badge_id.id,
      audienceId: entity.user_id.id,
      badge_type: entity.badge_type.value,
      progress: entity.progress,
      is_unlocked: entity.is_unlocked,
      unlocked_at: entity.unlocked_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: UserBadgePrismaModel): UserBadge {
    return new UserBadge({
      user_badge_id: new UserBadgeId(model.id),
      user_id: new Uuid(model.audienceId),
      badge_type: model.badge_type as BadgeTypeEnum,
      progress: model.progress,
      is_unlocked: model.is_unlocked,
      unlocked_at: model.unlocked_at,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
