import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

export type CreateUserPointsInputConstructorProps = {
  user_id: string;
  total_points?: number;
  total_scans?: number;
  total_requests?: number;
  total_tips?: number;
  total_social_shares?: number;
  current_level?: number;
  is_active?: boolean;
};

export class CreateUserPointsInput {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_points?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_scans?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_requests?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_tips?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_social_shares?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  current_level?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  constructor(props: CreateUserPointsInputConstructorProps) {
    if (!props) return;
    this.user_id = props.user_id;
    this.total_points = props.total_points;
    this.total_scans = props.total_scans;
    this.total_requests = props.total_requests;
    this.total_tips = props.total_tips;
    this.total_social_shares = props.total_social_shares;
    this.current_level = props.current_level;
    this.is_active = props.is_active;
  }
}

export class ValidateCreateUserPointsInput {
  static validate(input: CreateUserPointsInput) {
    return validateSync(input);
  }
}
