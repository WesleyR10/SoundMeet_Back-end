import { UserInteraction } from "../../../domain/user-interaction.aggregate";

export type UserInteractionOutput = {
  id: string;
  user_id: string;
  interaction_type: string;
  target_id: string | null;
  metadata: Record<string, any> | null;
  points_earned: number;
  created_at: Date;
  updated_at: Date;
};

export class UserInteractionOutputMapper {
  static toOutput(entity: UserInteraction): UserInteractionOutput {
    const { user_interaction_id, ...otherProps } = entity.toJSON();
    return {
      id: user_interaction_id,
      ...otherProps,
    };
  }
}
