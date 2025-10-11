import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  validateSync,
} from "class-validator";

export type UpdateUserBadgeInputConstructorProps = {
  id: string;
  progress?: number;
};

export class UpdateUserBadgeInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  constructor(props: UpdateUserBadgeInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.progress = props.progress;
  }
}

export class ValidateUpdateUserBadgeInput {
  static validate(input: UpdateUserBadgeInput) {
    return validateSync(input);
  }
}
