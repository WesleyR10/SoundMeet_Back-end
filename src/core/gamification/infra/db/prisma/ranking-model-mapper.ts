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
  user_id: string;
  establishment_id: string | null;
  position: number;
  score: number;
  period_start: Date;
  period_end: Date;
  is_active: boolean;
  metadata: any | null;
  created_at: Date;
  updated_at: Date;
};

export class RankingModelMapper {
  static toModel(entity: Ranking): RankingModelProps {
    return {
      id: entity.ranking_id.id,
      type: entity.ranking_type,
      period: entity.period,
      user_id: entity.user_id.id,
      establishment_id: entity.establishment_id?.id ?? null,
      position: entity.position,
      score: entity.score,
      period_start: entity.period_start,
      period_end: entity.period_end,
      is_active: entity.is_active,
      metadata: entity.metadata,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: RankingModelProps): Ranking {
    if (!model.user_id) {
      throw new LoadEntityError([
        {
          user_id: [`Ranking ${model.id} has missing user_id data in database`],
        },
      ]);
    }
    return new Ranking({
      ranking_id: new RankingId(model.id),
      user_id: new Uuid(model.user_id),
      establishment_id: model.establishment_id
        ? new Uuid(model.establishment_id)
        : null,
      ranking_type: model.type as RankingTypeEnum,
      period: model.period as RankingPeriodEnum,
      position: model.position || 0,
      score: model.score || 0,
      period_start: model.period_start,
      period_end: model.period_end,
      metadata: model.metadata ?? null,
      is_active: model.is_active ?? true,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
