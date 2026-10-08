import { Follow } from "../../../domain/follow.aggregate";
import { FollowTargetType } from "../../../domain/follow-types";

export type FollowTargetSummary = {
  name: string;
  avatar: string | null;
};

export type FollowOutput = {
  id: string;
  audience_id: string;
  target_type: FollowTargetType;
  target_id: string;
  notifications_enabled: boolean;
  created_at: Date;
  /** Só na listagem do fã ("Seguindo"); `null` quando o alvo sumiu/ficou oculto. */
  target?: FollowTargetSummary | null;
};

export class FollowOutputMapper {
  static toOutput(
    entity: Follow,
    target?: FollowTargetSummary | null,
  ): FollowOutput {
    return {
      id: entity.follow_id.id,
      audience_id: entity.audience_id,
      target_type: entity.target_type,
      target_id: entity.target_id,
      notifications_enabled: entity.notifications_enabled,
      created_at: entity.created_at,
      ...(target !== undefined ? { target } : {}),
    };
  }
}
