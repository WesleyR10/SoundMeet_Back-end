import { IsOptional, IsNumber, Min, Max, validateSync } from "class-validator";

export type GetLeaderboardInputConstructorProps = {
  limit?: number;
  level?: number;
};

export class GetLeaderboardInput {
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @IsNumber()
  @Min(1)
  @IsOptional()
  level?: number;

  constructor(props?: GetLeaderboardInputConstructorProps) {
    if (!props) return;
    this.limit = props.limit ?? 10;
    this.level = props.level;
  }
}

export class ValidateGetLeaderboardInput {
  static validate(input: GetLeaderboardInput) {
    return validateSync(input);
  }
}
