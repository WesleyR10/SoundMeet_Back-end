import { UserPoints } from "../../../domain/user-points.aggregate";
import { UserPointsLeaderboardEntry } from "../../../domain/user-points.repository";

export type UserPointsOutput = {
  id: string;
  user_id: string;
  total_points: number;
  total_scans: number;
  total_requests: number;
  total_tips: number;
  total_social_shares: number;
  current_level: number;
  level_info: {
    level: number;
    name: string;
    min_points: number;
    max_points: number;
    benefits: string[];
  };
  progress_to_next_level: number;
  is_top_fan: boolean;
  is_active_supporter: boolean;
  created_at: Date;
  updated_at: Date;
  // Só populado no leaderboard (7.16b) — GetUserPointsUseCase (consulta do
  // próprio usuário) não precisa do próprio nome/avatar, então não enriquece.
  nickname?: string | null;
  avatar?: string | null;
};

export class UserPointsOutputMapper {
  static toOutput(entity: UserPoints): UserPointsOutput {
    const { user_points_id, is_active, ...otherProps } = entity.toJSON();
    return {
      id: user_points_id,
      ...otherProps,
    } as UserPointsOutput;
  }

  static toLeaderboardOutput(
    entry: UserPointsLeaderboardEntry,
  ): UserPointsOutput {
    return {
      ...UserPointsOutputMapper.toOutput(entry.user_points),
      nickname: entry.nickname,
      avatar: entry.avatar,
    };
  }
}
