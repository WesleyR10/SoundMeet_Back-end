import { UserScore } from "../../../domain/user-score.aggregate";

export type UserScoreOutput = {
  id: string;
  user_id: string;
  score_type: string;
  points: number;
  reference_id: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

export class UserScoreOutputMapper {
  static toOutput(entity: UserScore): UserScoreOutput {
    const { user_score_id, ...otherProps } = entity.toJSON();
    return {
      id: user_score_id,
      ...otherProps,
    } as UserScoreOutput;
  }
}
