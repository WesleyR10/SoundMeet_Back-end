import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  validateSync,
} from "class-validator";

export type UpdateRankingInputConstructorProps = {
  id: string;
  position?: number;
  score?: number;
};

export class UpdateRankingInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  position?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  score?: number;

  constructor(props: UpdateRankingInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.position = props.position;
    this.score = props.score;
  }
}

export class ValidateUpdateRankingInput {
  static validate(input: UpdateRankingInput) {
    return validateSync(input);
  }
}
