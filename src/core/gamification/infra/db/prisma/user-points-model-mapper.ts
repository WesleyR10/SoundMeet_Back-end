import { UserPoints as PrismaUserPoints } from "@prisma/client";

import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  UserPoints,
  UserPointsId,
} from "../../../domain/user-points.aggregate";

export type UserPointsModelProps = {
  id: string;
  audienceId: string;
  total_points: number;
  total_scans: number;
  total_requests: number;
  total_tips: number;
  total_social_shares: number;
  current_level: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class UserPointsModelMapper {
  static toModel(entity: UserPoints): UserPointsModelProps {
    return {
      id: entity.user_points_id.id,
      audienceId: entity.user_id.id,
      total_points: entity.total_points,
      total_scans: entity.total_scans,
      total_requests: entity.total_requests,
      total_tips: entity.total_tips,
      total_social_shares: entity.total_social_shares,
      current_level: entity.current_level,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: PrismaUserPoints): UserPoints {
    return new UserPoints({
      user_points_id: new UserPointsId(model.id),
      user_id: new Uuid(model.audienceId),
      total_points: model.total_points,
      total_scans: model.total_scans,
      total_requests: model.total_requests,
      total_tips: Number(model.total_tips),
      total_social_shares: model.total_social_shares,
      current_level: model.current_level,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
