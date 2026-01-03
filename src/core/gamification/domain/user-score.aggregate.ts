import { AggregateRoot, Uuid } from "../../shared/domain";
import { ValueObject } from "../../shared/domain/value-object";
import { UserScoreValidatorFactory } from "./user-score.validator";
import { UserScoreFakeBuilder } from "./user-score-fake.builder";
import { UserScoreId } from "./value-objects/gamification-id.vo";
import { ScoreTypeEnum } from "./value-objects/score-type.vo";

export { UserScoreId } from "./value-objects/gamification-id.vo";

export type UserScoreConstructorProps = {
  id?: UserScoreId;
  user_id: Uuid;
  score_type: ScoreTypeEnum;
  points: number;
  reference_id?: string | null;
  description?: string | null;
  created_at?: Date;
};

export type UserScoreCreateCommand = {
  user_id: Uuid;
  score_type: ScoreTypeEnum;
  points?: number;
  reference_id?: string | null;
  description?: string | null;
};

export class UserScore extends AggregateRoot {
  id: UserScoreId;
  user_id: Uuid;
  score_type: ScoreTypeEnum;
  points: number;
  reference_id: string | null;
  description: string | null;
  created_at: Date;

  constructor(props: UserScoreConstructorProps) {
    super();
    this.id = props.id ?? UserScoreId.create();
    this.user_id = props.user_id;
    this.score_type = props.score_type;
    this.points = props.points;
    this.reference_id = props.reference_id ?? null;
    this.description = props.description ?? null;
    this.created_at = props.created_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(props: UserScoreCreateCommand): UserScore {
    const userScore = new UserScore({
      user_id: props.user_id,
      score_type: props.score_type,
      points: props.points ?? 0,
      reference_id: props.reference_id,
      description: props.description,
    });

    userScore.validate(["user_id", "score_type", "points"]);

    if (!Object.values(ScoreTypeEnum).includes(userScore.score_type)) {
      userScore.notification.addError(
        "score_type must be a valid ScoreType",
        "score_type",
      );
    }

    if (!userScore.notification.hasErrors() && props.points === undefined) {
      userScore.points = UserScore.getDefaultPoints(userScore.score_type);
    }

    return userScore;
  }

  changePoints(points: number): void {
    this.points = points;
    this.validate(["points"]);
  }

  changeDescription(description: string | null): void {
    this.description = description;
  }

  updateReference(reference_id: string | null): void {
    this.reference_id = reference_id;
  }

  isValidForScoreType(): boolean {
    if (this.score_type === ScoreTypeEnum.TIP_GIVEN) {
      return this.points >= 0;
    }
    return this.points === UserScore.getDefaultPoints(this.score_type);
  }

  getScoreTypeDescription(): string {
    const descriptions = {
      [ScoreTypeEnum.QR_SCAN]: "Escaneou QR Code",
      [ScoreTypeEnum.REQUEST_SENT]: "Enviou pedido musical",
      [ScoreTypeEnum.REQUEST_ACCEPTED]: "Pedido aceito pelo músico",
      [ScoreTypeEnum.TIP_GIVEN]: "Deu gorjeta",
      [ScoreTypeEnum.SOCIAL_SHARE]: "Compartilhou nas redes sociais",
      [ScoreTypeEnum.PROFILE_VIEW]: "Visualizou perfil",
      [ScoreTypeEnum.EVENT_ATTENDANCE]: "Participou de evento",
    };

    return descriptions[this.score_type] ?? "";
  }

  validate(fields?: string[]): boolean {
    const validator = UserScoreValidatorFactory.create();
    return validator.validate(
      this.notification,
      {
        user_id: this.user_id.id,
        score_type: this.score_type,
        points: this.points,
        reference_id: this.reference_id,
        description: this.description,
      },
      fields,
    );
  }

  static fake() {
    return UserScoreFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      user_id: this.user_id.id,
      score_type: this.score_type,
      points: this.points,
      reference_id: this.reference_id,
      description: this.description,
      created_at: this.created_at,
    };
  }

  private static getDefaultPoints(score_type: ScoreTypeEnum): number {
    const pointsMap = {
      [ScoreTypeEnum.QR_SCAN]: 10,
      [ScoreTypeEnum.REQUEST_SENT]: 25,
      [ScoreTypeEnum.REQUEST_ACCEPTED]: 50,
      [ScoreTypeEnum.TIP_GIVEN]: 1,
      [ScoreTypeEnum.SOCIAL_SHARE]: 50,
      [ScoreTypeEnum.PROFILE_VIEW]: 5,
      [ScoreTypeEnum.EVENT_ATTENDANCE]: 20,
    };
    return pointsMap[score_type] ?? 0;
  }
}
