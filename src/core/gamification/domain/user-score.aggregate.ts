import { ValueObject } from "../../shared/domain/value-object";
import { UserScoreValidatorFactory } from "./user-score.validator";
import { UserScoreFakeBuilder } from "./user-score-fake.builder";
import { AggregateRoot, Uuid } from "../../shared/domain";
import { UserScoreId } from "./value-objects/gamification-id.vo";
import { ScoreType, ScoreTypeEnum } from "./value-objects/score-type.vo";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";

export { UserScoreId } from "./value-objects/gamification-id.vo";

export type UserScoreConstructorProps = {
  id?: UserScoreId;
  user_id: string;
  score_type: ScoreTypeEnum;
  points: number;
  reference_id?: string | null;
  description?: string | null;
  created_at?: Date;
};

export type UserScoreCreateCommand = {
  user_id: string;
  score_type: ScoreTypeEnum;
  points?: number;
  reference_id?: string | null;
  description?: string | null;
};

export class UserScore extends AggregateRoot {
  id: UserScoreId;
  user_id: Uuid;
  score_type: ScoreType;
  points: number;
  reference_id: string | null;
  description: string | null;
  created_at: Date;

  constructor(props: UserScoreConstructorProps) {
    super();
    this.id = props.id ?? UserScoreId.create();

    try {
      this.user_id = new Uuid(props.user_id);
    } catch (error) {
      // Create a temporary invalid Uuid-like object for validation
      this.user_id = { id: props.user_id } as any;
    }

    try {
      this.score_type = new ScoreType(props.score_type);
    } catch (error) {
      // Create a temporary invalid ScoreType-like object for validation
      this.score_type = { value: props.score_type } as any;
    }

    this.points = props.points;
    this.reference_id = props.reference_id ?? null;
    this.description = props.description ?? null;
    this.created_at = props.created_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(props: UserScoreCreateCommand): UserScore {
    // Validar user_id antes de criar o Uuid
    if (!props.user_id || props.user_id.trim() === "") {
      throw new EntityValidationError([
        {
          user_id: ["user_id should not be empty"],
        },
      ]);
    }

    // Validar score_type antes de criar o ScoreType
    if (
      !props.score_type ||
      !Object.values(ScoreTypeEnum).includes(props.score_type)
    ) {
      throw new EntityValidationError([
        {
          score_type: ["score_type must be a valid ScoreType"],
        },
      ]);
    }

    // Validar points se fornecido
    if (props.points !== undefined && props.points < 0) {
      throw new EntityValidationError([
        {
          points: ["points must be greater than or equal to 0"],
        },
      ]);
    }

    const userScore = new UserScore({
      user_id: props.user_id,
      score_type: props.score_type,
      points: props.points ?? 0, // Will be set to correct value after ScoreType validation
      reference_id: props.reference_id,
      description: props.description,
    });

    // Set correct points after validation passes
    if (
      !userScore.notification.hasErrors() &&
      props.points === undefined &&
      userScore.score_type instanceof ScoreType
    ) {
      userScore.points = userScore.score_type.getPoints();
    }

    return userScore;
  }

  changePoints(points: number): void {
    this.points = points;
    const isValid = this.validate(["points"]);
    if (!isValid) {
      throw new EntityValidationError(this.notification.toJSON());
    }
  }

  changeDescription(description: string | null): void {
    this.description = description;
  }

  updateReference(reference_id: string | null): void {
    this.reference_id = reference_id;
  }

  isValidForScoreType(): boolean {
    return this.points === this.score_type.getPoints();
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

    return descriptions[this.score_type.value];
  }

  validate(fields?: string[]): boolean {
    const validator = UserScoreValidatorFactory.create();
    return validator.validate(
      this.notification,
      {
        user_id: this.user_id?.id,
        score_type: this.score_type?.value,
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
      user_id: this.user_id?.id || this.user_id,
      score_type: this.score_type?.value || this.score_type,
      points: this.points,
      reference_id: this.reference_id,
      description: this.description,
      created_at: this.created_at,
    };
  }
}
