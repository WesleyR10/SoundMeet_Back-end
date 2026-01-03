import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Ranking, RankingId } from "../../../domain/ranking.aggregate";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "../../../domain/value-objects/ranking-type.vo";

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
      type: entity.ranking_type,
      period: entity.period,
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
    if (!data.user_id) {
      throw new LoadEntityError([
        {
          user_id: [`Ranking ${model.id} has missing user_id data in database`],
        },
      ]);
    }
    return new Ranking({
      id: new RankingId(model.id),
      user_id: new Uuid(data.user_id),
      ranking_type: model.type as RankingTypeEnum,
      period: model.period as RankingPeriodEnum,
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
