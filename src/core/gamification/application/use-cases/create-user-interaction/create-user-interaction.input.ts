import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

export type CreateUserInteractionInputConstructorProps = {
  user_id: string;
  interaction_type: string;
  target_id?: string;
  metadata?: Record<string, any>;
  points_earned?: number;
};

export class CreateUserInteractionInput {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  interaction_type: string;

  @IsString()
  @IsOptional()
  target_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points_earned?: number;

  constructor(props: CreateUserInteractionInputConstructorProps) {
    if (!props) return;
    this.user_id = props.user_id;
    this.interaction_type = props.interaction_type;
    this.target_id = props.target_id;
    this.metadata = props.metadata;
    this.points_earned = props.points_earned;
  }
}

export class ValidateCreateUserInteractionInput {
  static validate(input: CreateUserInteractionInput) {
    return validateSync(input);
  }
}
