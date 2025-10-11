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
    const entityJson = entity.toJSON();
    return {
      id: entityJson.id,
      user_id: entityJson.user_id,
      total_points: entityJson.total_points,
      total_scans: entityJson.total_scans,
      total_requests: entityJson.total_requests,
      total_tips: entityJson.total_tips,
      total_social_shares: entityJson.total_social_shares,
      current_level: entityJson.current_level,
      level_info: entityJson.level_info,
      progress_to_next_level: entityJson.progress_to_next_level,
      is_top_fan: entityJson.is_top_fan,
      is_active_supporter: entityJson.is_active_supporter,
      created_at: entityJson.created_at,
      updated_at: entityJson.updated_at,
    } as UserPointsOutput;
  }
}
