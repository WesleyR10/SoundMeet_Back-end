import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Follow, FollowId } from "../../../domain/follow.aggregate";
import { FollowTargetType } from "../../../domain/follow-types";

export type FollowModel = {
  id: string;
  audience_id: string;
  target_type: string;
  target_id: string;
  notifications_enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export class FollowModelMapper {
  static toModel(entity: Follow): FollowModel {
    return {
      id: entity.follow_id.id,
      audience_id: entity.audience_id,
      target_type: entity.target_type,
      target_id: entity.target_id,
      notifications_enabled: entity.notifications_enabled,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: FollowModel): Follow {
    const follow = new Follow({
      follow_id: new FollowId(model.id),
      audience_id: model.audience_id,
      target_type: model.target_type as FollowTargetType,
      target_id: model.target_id,
      notifications_enabled: model.notifications_enabled,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    // `target_type` é String no banco: uma linha corrompida só aparece aqui.
    follow.validate();
    if (follow.notification.hasErrors()) {
      throw new LoadEntityError(follow.notification.toJSON());
    }

    return follow;
  }
}
