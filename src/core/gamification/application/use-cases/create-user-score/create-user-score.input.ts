import { ScoreTypeEnum } from "@core/gamification/domain/value-objects/score-type.vo";
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

export type CreateUserScoreInputConstructorProps = {
  user_id: string;
  score_type: ScoreTypeEnum;
  points: number;
  reference_id?: string;
  description?: string;
};

export class CreateUserScoreInput {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsIn([
    "qr_scan",
    "request_sent",
    "request_accepted",
    "tip_given",
    "social_share",
    "profile_view",
    "event_attendance",
  ])
  @IsNotEmpty()
  score_type: ScoreTypeEnum;

  @IsNumber()
  @Min(0)
  points: number;

  @IsString()
  @IsOptional()
  reference_id?: string;

  @IsString()
  @IsOptional()
  description?: string;

  constructor(props: CreateUserScoreInputConstructorProps) {
    if (!props) return;
    this.user_id = props.user_id;
    this.score_type = props.score_type;
    this.points = props.points;
    this.reference_id = props.reference_id;
    this.description = props.description;
  }
}

export class ValidateCreateUserScoreInput {
  static validate(input: CreateUserScoreInput) {
    return validateSync(input);
  }
}
