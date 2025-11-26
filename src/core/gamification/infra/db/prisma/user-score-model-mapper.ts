import { UserScore } from "../../../domain/user-score.aggregate";
import { UserScoreId } from "../../../domain/user-score.aggregate";

export type UserScoreModelProps = {
  id: string;
  user_id: string;
  score_type: string;
  points: number;
  reference_id: string | null;
  description: string | null;
  created_at: Date;
};

export class UserScoreModelMapper {
  static toModel(entity: UserScore): UserScoreModelProps {
    return {
      id: entity.id.id,
      user_id: entity.user_id.id,
      score_type: entity.score_type.value,
      points: entity.points,
      reference_id: entity.reference_id,
      description: entity.description,
      created_at: entity.created_at,
    };
  }

  static toEntity(model: UserScoreModelProps): UserScore {
    return new UserScore({
      id: new UserScoreId(model.id),
      user_id: model.user_id,
      score_type: model.score_type as any,
      points: model.points,
      reference_id: model.reference_id,
      description: model.description,
      created_at: model.created_at,
    });
  }
}
