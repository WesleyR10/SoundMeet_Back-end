import { Ranking, RankingId } from "../../../domain/ranking.aggregate";

export type RankingModelProps = {
  id: string;
  type: string;
  period: string;
  data: any;
  created_at: Date;
};

export class RankingModelMapper {
  static toModel(entity: Ranking): RankingModelProps {
    return {
      id: entity.id.id,
      type: entity.ranking_type.value,
      period: entity.period.value,
      data: {
        user_id: entity.user_id.id,
        position: entity.position,
        score: entity.score,
        period_start: entity.period_start,
        period_end: entity.period_end,
        is_active: entity.is_active,
        updated_at: entity.updated_at,
      },
      created_at: entity.created_at,
    };
  }

  static toEntity(model: RankingModelProps): Ranking {
    const data = model.data || {};
    return new Ranking({
      id: new RankingId(model.id),
      user_id: data.user_id || "",
      ranking_type: model.type as any,
      period: model.period as any,
      position: data.position || 0,
      score: data.score || 0,
      period_start: data.period_start
        ? new Date(data.period_start)
        : new Date(),
      period_end: data.period_end ? new Date(data.period_end) : new Date(),
      is_active: data.is_active ?? true,
      created_at: model.created_at,
      updated_at: data.updated_at ? new Date(data.updated_at) : new Date(),
    });
  }
}
