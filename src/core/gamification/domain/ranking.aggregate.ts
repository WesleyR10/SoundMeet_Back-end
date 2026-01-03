import { AggregateRoot, Uuid } from "../../shared/domain";
import { ValueObject } from "../../shared/domain/value-object";
import { RankingValidatorFactory } from "./ranking.validator";
import { RankingFakeBuilder } from "./ranking-fake.builder";
import { RankingId } from "./value-objects/gamification-id.vo";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "./value-objects/ranking-type.vo";

// Export RankingId for use in tests
export { RankingId } from "./value-objects/gamification-id.vo";

// Export types for use in use cases
export {
  RankingTypeEnum as PeriodType,
  RankingPeriodEnum,
} from "./value-objects/ranking-type.vo";

export type RankingConstructorProps = {
  id?: RankingId;
  user_id: Uuid;
  ranking_type: RankingTypeEnum;
  period: RankingPeriodEnum;
  position: number;
  score: number;
  period_start: Date;
  period_end: Date;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type RankingCreateCommand = {
  user_id: Uuid;
  ranking_type: RankingTypeEnum;
  period: RankingPeriodEnum;
  position: number;
  score: number;
  period_start: Date;
  period_end: Date;
};

export class Ranking extends AggregateRoot {
  id: RankingId;
  user_id: Uuid;
  ranking_type: RankingTypeEnum;
  period: RankingPeriodEnum;
  position: number;
  score: number;
  period_start: Date;
  period_end: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: RankingConstructorProps) {
    super();
    this.id = props.id ?? RankingId.create();
    this.user_id = props.user_id;
    this.ranking_type = props.ranking_type;
    this.period = props.period;
    this.position = props.position;
    this.score = props.score;
    this.period_start = props.period_start;
    this.period_end = props.period_end;
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(command: RankingCreateCommand): Ranking {
    const ranking = new Ranking({
      user_id: command.user_id,
      ranking_type: command.ranking_type,
      period: command.period,
      position: command.position,
      score: command.score,
      period_start: command.period_start,
      period_end: command.period_end,
    });

    ranking.validate([
      "user_id",
      "ranking_type",
      "period",
      "position",
      "score",
      "period_start",
      "period_end",
    ]);

    return ranking;
  }

  updatePosition(position: number): void {
    if (position < 1) {
      this.notification.addError("Position must be greater than 0", "position");
      return;
    }
    this.position = position;
    this.updated_at = new Date();
    this.validate(["position"]);
  }

  updateScore(score: number): void {
    if (score < 0) {
      this.notification.addError("Score cannot be negative", "score");
      return;
    }
    this.score = score;
    this.updated_at = new Date();
    this.validate(["score"]);
  }

  isCurrentPeriod(): boolean {
    const now = new Date();
    return now >= this.period_start && now <= this.period_end;
  }

  isTopPosition(): boolean {
    return this.position <= 3;
  }

  getPositionMedal(): string | null {
    switch (this.position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return null;
    }
  }

  getRankingDescription(): string {
    const rankingMap = {
      [RankingTypeEnum.TOP_FAS]: "Top Fãs",
      [RankingTypeEnum.TOP_SUGESTOES]: "Top Sugestões",
      [RankingTypeEnum.TOP_APOIADORES]: "Top Apoiadores",
      [RankingTypeEnum.TOP_DISCOVERERS]: "Top Discoverers",
    };
    return rankingMap[this.ranking_type] ?? "";
  }

  getPeriodDescription(): string {
    const periodMap = {
      [RankingPeriodEnum.DAILY]: "Diário",
      [RankingPeriodEnum.WEEKLY]: "Semanal",
      [RankingPeriodEnum.MONTHLY]: "Mensal",
      [RankingPeriodEnum.YEARLY]: "Anual",
      [RankingPeriodEnum.ALL_TIME]: "Todos os Tempos",
    };

    return periodMap[this.period] ?? "";
  }

  updatePeriod(start: Date, end: Date): void {
    if (end <= start) {
      this.notification.addError(
        "Period end must be after period start",
        "period_end",
      );
      return;
    }
    this.period_start = start;
    this.period_end = end;
    this.updated_at = new Date();
    this.validate(["period_start", "period_end"]);
  }

  activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  validate(fields?: string[]): boolean {
    const validator = RankingValidatorFactory.create();
    const isValid = validator.validate(this.notification, this, fields);

    if (!Object.values(RankingTypeEnum).includes(this.ranking_type)) {
      this.notification.addError(
        "ranking_type must be a valid RankingType",
        "ranking_type",
      );
    }

    if (!Object.values(RankingPeriodEnum).includes(this.period)) {
      this.notification.addError(
        "period must be a valid RankingPeriod",
        "period",
      );
    }

    if (
      this.period_start instanceof Date &&
      this.period_end instanceof Date &&
      this.period_end <= this.period_start
    ) {
      this.notification.addError(
        "Period end must be after period start",
        "period_end",
      );
    }

    return isValid;
  }

  static fake() {
    return RankingFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      user_id: this.user_id.id,
      ranking_type: this.ranking_type,
      period: this.period,
      position: this.position,
      score: this.score,
      period_start: this.period_start,
      period_end: this.period_end,
      is_active: this.is_active,
      is_current_period: this.isCurrentPeriod(),
      is_top_position: this.isTopPosition(),
      medal: this.getPositionMedal(),
      ranking_description: this.getRankingDescription(),
      period_description: this.getPeriodDescription(),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
