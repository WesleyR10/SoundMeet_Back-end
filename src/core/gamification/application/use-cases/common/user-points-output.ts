import { UserPoints } from "../../../domain/user-points.aggregate";

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
};

export class UserPointsOutputMapper {
  static toOutput(entity: UserPoints): UserPointsOutput {
    const { user_points_id, is_active, ...otherProps } = entity.toJSON();
    return {
      id: user_points_id,
      ...otherProps,
    } as UserPointsOutput;
  }
}
