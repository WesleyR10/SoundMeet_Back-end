import { UserBadge } from "../../../domain/user-badge.aggregate";

export type UserBadgeOutput = {
  id: string;
  user_id: string;
  badge_type: string;
  progress: number;
  is_unlocked: boolean;
  unlocked_at: Date | null;
  created_at: Date;
  updated_at: Date;
  progress_percentage: number;
  remaining_points: number;
  badge_description: string;
};

export class UserBadgeOutputMapper {
  static toOutput(entity: UserBadge): UserBadgeOutput {
    const { user_badge_id, ...otherProps } = entity.toJSON();
    return {
      id: user_badge_id,
      ...otherProps,
      progress_percentage: entity.getProgressPercentage(),
      remaining_points: entity.getRemainingPoints(),
      badge_description: entity.getBadgeDescription(),
    } as UserBadgeOutput;
  }
}
