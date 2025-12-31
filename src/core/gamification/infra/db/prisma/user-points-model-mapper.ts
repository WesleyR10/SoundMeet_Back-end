import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  UserPoints,
  UserPointsId,
} from "../../../domain/user-points.aggregate";

export type UserPointsModelProps = {
  id: string;
  audienceId: string;
  points: number;
  source: string;
  description: string | null;
  metadata: any;
  created_at: Date;
};

export class UserPointsModelMapper {
  static toModel(entity: UserPoints): UserPointsModelProps {
    return {
      id: entity.id.id,
      audienceId: entity.user_id.id,
      points: entity.total_points,
      source: "system", // Valor padrão baseado no domínio
      description: null,
      metadata: {
        total_scans: entity.total_scans,
        total_requests: entity.total_requests,
        total_tips: entity.total_tips,
        total_social_shares: entity.total_social_shares,
        current_level: entity.current_level,
        is_active: entity.is_active,
        updated_at: entity.updated_at,
      },
      created_at: entity.created_at,
    };
  }

  static toEntity(model: UserPointsModelProps): UserPoints {
    const metadata = model.metadata || {};
    return new UserPoints({
      id: new UserPointsId(model.id),
      user_id: new Uuid(model.audienceId),
      total_points: model.points,
      total_scans: metadata.total_scans || 0,
      total_requests: metadata.total_requests || 0,
      total_tips: metadata.total_tips || 0,
      total_social_shares: metadata.total_social_shares || 0,
      current_level: metadata.current_level || 1,
      is_active: metadata.is_active !== undefined ? metadata.is_active : true,
      created_at: model.created_at,
      updated_at: metadata.updated_at || model.created_at,
    });
  }
}
