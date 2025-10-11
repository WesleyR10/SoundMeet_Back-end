import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

export type UpdateUserPointsInputConstructorProps = {
  id: string;
  total_points?: number;
  total_scans?: number;
  total_requests?: number;
  total_tips?: number;
  total_social_shares?: number;
  current_level?: number;
  is_active?: boolean;
};

export class UpdateUserPointsInput {
  @IsString()
  @IsNotEmpty()
  id: string;

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

  constructor(props: UpdateUserPointsInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.total_points = props.total_points;
    this.total_scans = props.total_scans;
    this.total_requests = props.total_requests;
    this.total_tips = props.total_tips;
    this.total_social_shares = props.total_social_shares;
    this.current_level = props.current_level;
    this.is_active = props.is_active;
  }
}

export class ValidateUpdateUserPointsInput {
  static validate(input: UpdateUserPointsInput) {
    return validateSync(input);
  }
}
