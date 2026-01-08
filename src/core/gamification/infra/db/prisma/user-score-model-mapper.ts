import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserScore } from "../../../domain/user-score.aggregate";
import { UserScoreId } from "../../../domain/user-score.aggregate";
import { ScoreTypeEnum } from "../../../domain/value-objects/score-type.vo";

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
      id: entity.user_score_id.id,
      user_id: entity.user_id.id,
      score_type: entity.score_type,
      points: entity.points,
      reference_id: entity.reference_id,
      description: entity.description,
      created_at: entity.created_at,
    };
  }

  static toEntity(model: UserScoreModelProps): UserScore {
    let userId: Uuid;
    try {
      userId = new Uuid(model.user_id);
    } catch (e) {
      throw new LoadEntityError([
        {
          user_id: [
            `UserScore ${model.id} has invalid user_id data in database`,
          ],
        },
      ]);
    }
    return new UserScore({
      user_score_id: new UserScoreId(model.id),
      user_id: userId,
      score_type: model.score_type as ScoreTypeEnum,
      points: model.points,
      reference_id: model.reference_id,
      description: model.description,
      created_at: model.created_at,
    });
  }
}
