import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsObject,
  validateSync,
} from "class-validator";

export type UpdateUserInteractionInputConstructorProps = {
  id: string;
  interaction_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
  points_earned?: number;
};

export class UpdateUserInteractionInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  interaction_type?: string;

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

  constructor(props: UpdateUserInteractionInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.interaction_type = props.interaction_type;
    this.target_id = props.target_id;
    this.metadata = props.metadata;
    this.points_earned = props.points_earned;
  }
}

export class ValidateUpdateUserInteractionInput {
  static validate(input: UpdateUserInteractionInput) {
    return validateSync(input);
  }
}
