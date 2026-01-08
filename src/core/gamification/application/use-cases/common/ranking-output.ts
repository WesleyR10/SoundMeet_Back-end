import { Ranking } from "../../../domain/ranking.aggregate";

export type RankingOutput = {
  id: string;
  user_id: string;
  ranking_type: string;
  period: string;
  position: number;
  score: number;
  period_start: Date;
  period_end: Date;
  created_at: Date;
  updated_at: Date;
  is_current_period: boolean;
  is_top_position: boolean;
  position_medal: string | null;
  ranking_description: string;
  period_description: string;
};

export class RankingOutputMapper {
  static toOutput(entity: Ranking): RankingOutput {
    const { ranking_id, ...otherProps } = entity.toJSON();
    return {
      id: ranking_id,
      ...otherProps,
      is_current_period: entity.isCurrentPeriod(),
      is_top_position: entity.isTopPosition(),
      position_medal: entity.getPositionMedal(),
      ranking_description: entity.getRankingDescription(),
      period_description: entity.getPeriodDescription(),
    } as RankingOutput;
  }
}
