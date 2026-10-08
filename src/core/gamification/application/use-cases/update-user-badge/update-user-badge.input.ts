import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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
  // Pontos, não percentual — ver `user-badge.validator.ts`.
  @Min(0)
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
